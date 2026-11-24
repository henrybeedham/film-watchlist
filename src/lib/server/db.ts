import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { join } from 'node:path';
import { BUILDING, DATA_DIR } from './config';
import { backupBeforeMigrating, backupOnNewVersion } from './backups';

// While building, an in-memory database stands in so nothing is written to disk.
export const db = new DatabaseSync(BUILDING ? ':memory:' : join(DATA_DIR, 'app.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

type Params = Record<string, SQLInputValue> | SQLInputValue[] | SQLInputValue;
const bind = (p?: Params): SQLInputValue[] =>
	p === undefined ? [] : Array.isArray(p) ? p : [p as SQLInputValue];

// node:sqlite's typings want a tuple; the spread is safe at runtime.
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
export const run = (sql: string, p?: Params) => db.prepare(sql).run(...(bind(p) as any[]));
export const get = <T>(sql: string, p?: Params) =>
	db.prepare(sql).get(...(bind(p) as any[])) as T | undefined;
export const all = <T>(sql: string, p?: Params) =>
	db.prepare(sql).all(...(bind(p) as any[])) as T[];
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
export const placeholders = (n: number) => Array(n).fill('?').join(', ');

let depth = 0;
export function transaction<T>(fn: () => T): T {
	if (depth > 0) return fn(); // nested calls join the outer transaction
	depth++;
	db.exec('BEGIN IMMEDIATE');
	try {
		const result = fn();
		db.exec('COMMIT');
		return result;
	} catch (e) {
		db.exec('ROLLBACK');
		throw e;
	} finally {
		depth--;
	}
}

export const now = () => new Date().toISOString();

// Never edit or reorder entries that have shipped; add new ones at the end.
const MIGRATIONS: (string | ((db: DatabaseSync) => void))[] = [
	// 1: better-auth tables (generated with better-auth's getMigrations for SQLite)
	`
	CREATE TABLE "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null);
	CREATE TABLE "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);
	CREATE TABLE "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null);
	CREATE TABLE "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null);
	CREATE INDEX "session_userId_idx" on "session" ("userId");
	CREATE INDEX "account_userId_idx" on "account" ("userId");
	CREATE INDEX "verification_identifier_idx" on "verification" ("identifier");
	`,
	// 2: the app's own tables
	`
	CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

	CREATE TABLE lists (
		id INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		owner_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
		share_token TEXT UNIQUE,
		created_at TEXT NOT NULL
	);

	CREATE TABLE list_members (
		list_id INTEGER NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
		user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
		role TEXT NOT NULL CHECK (role IN ('owner', 'editor')),
		joined_at TEXT NOT NULL,
		PRIMARY KEY (list_id, user_id)
	);
	CREATE INDEX list_members_user ON list_members (user_id);

	CREATE TABLE invites (
		token TEXT PRIMARY KEY,
		list_id INTEGER NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
		created_by TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
		created_at TEXT NOT NULL,
		expires_at TEXT NOT NULL,
		used_at TEXT,
		used_by TEXT REFERENCES "user" (id) ON DELETE SET NULL
	);

	-- TMDB details, shared by every list that contains the title.
	CREATE TABLE titles (
		media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
		tmdb_id INTEGER NOT NULL,
		title TEXT NOT NULL,
		original_title TEXT,
		release_date TEXT,
		status TEXT,
		runtime INTEGER,
		seasons INTEGER,
		genres TEXT NOT NULL DEFAULT '[]',
		overview TEXT,
		poster_path TEXT,
		backdrop_path TEXT,
		providers TEXT,
		providers_link TEXT,
		details_at TEXT,
		providers_at TEXT,
		PRIMARY KEY (media_type, tmdb_id)
	);

	CREATE TABLE items (
		id INTEGER PRIMARY KEY,
		list_id INTEGER NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
		title TEXT NOT NULL,
		media_type TEXT CHECK (media_type IN ('movie', 'tv')),
		tmdb_id INTEGER,
		match_status TEXT NOT NULL DEFAULT 'pending'
			CHECK (match_status IN ('pending', 'matched', 'guess', 'none')),
		kind_hint TEXT CHECK (kind_hint IN ('movie', 'tv')),
		year_hint INTEGER,
		mentions INTEGER NOT NULL DEFAULT 1,
		recommended_by TEXT,
		note TEXT,
		release_override TEXT,
		status TEXT NOT NULL DEFAULT 'want' CHECK (status IN ('want', 'watched')),
		watched_at TEXT,
		added_by TEXT REFERENCES "user" (id) ON DELETE SET NULL,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);
	CREATE INDEX items_list ON items (list_id, status);
	CREATE INDEX items_pending ON items (match_status);

	CREATE TABLE diary (
		id INTEGER PRIMARY KEY,
		item_id INTEGER NOT NULL REFERENCES items (id) ON DELETE CASCADE,
		user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
		watched_on TEXT,
		rating INTEGER CHECK (rating BETWEEN 1 AND 10),
		review TEXT,
		created_at TEXT NOT NULL
	);
	CREATE INDEX diary_item ON diary (item_id);

	CREATE TABLE prefs (
		user_id TEXT PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
		theme TEXT NOT NULL DEFAULT 'programme',
		mode TEXT NOT NULL DEFAULT 'system',
		view TEXT,
		current_list_id INTEGER REFERENCES lists (id) ON DELETE SET NULL,
		services TEXT NOT NULL DEFAULT '[]'
	);
	`,
	// 3: invites to the site without a list (list_id becomes nullable)
	`
	CREATE TABLE invites_new (
		token TEXT PRIMARY KEY,
		list_id INTEGER REFERENCES lists (id) ON DELETE CASCADE,
		created_by TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
		created_at TEXT NOT NULL,
		expires_at TEXT NOT NULL,
		used_at TEXT,
		used_by TEXT REFERENCES "user" (id) ON DELETE SET NULL
	);
	INSERT INTO invites_new SELECT token, list_id, created_by, created_at, expires_at, used_at, used_by FROM invites;
	DROP TABLE invites;
	ALTER TABLE invites_new RENAME TO invites;
	`,
	// 4: a person's theme can be unset, meaning "use the site's default theme". Anyone still on the
	// original default never picked one, so they follow the site default from now on.
	`
	CREATE TABLE prefs_new (
		user_id TEXT PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
		theme TEXT,
		mode TEXT NOT NULL DEFAULT 'system',
		view TEXT,
		current_list_id INTEGER REFERENCES lists (id) ON DELETE SET NULL,
		services TEXT NOT NULL DEFAULT '[]'
	);
	INSERT INTO prefs_new SELECT user_id, NULLIF(theme, 'programme'), mode, view, current_list_id, services
		FROM prefs;
	DROP TABLE prefs;
	ALTER TABLE prefs_new RENAME TO prefs;
	`,
	// 5: site admins. Until now the first account was the only admin; it stays one.
	`
	CREATE TABLE site_admins (
		user_id TEXT PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
		added_at TEXT NOT NULL
	);
	INSERT INTO site_admins (user_id, added_at)
		SELECT id, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM "user" ORDER BY "createdAt", rowid LIMIT 1;
	`
	// add new migrations here
];

function migrate() {
	const current = (db.prepare('PRAGMA user_version').get() as { user_version: number })
		.user_version;
	if (current > MIGRATIONS.length) throw new Error('Database is newer than this app version.');
	if (current < MIGRATIONS.length && current > 0) backupBeforeMigrating(db, current);
	for (let v = current; v < MIGRATIONS.length; v++) {
		const step = MIGRATIONS[v];
		db.exec('BEGIN IMMEDIATE');
		try {
			if (typeof step === 'string') db.exec(step);
			else step(db);
			db.exec(`PRAGMA user_version = ${v + 1}`);
			db.exec('COMMIT');
		} catch (e) {
			db.exec('ROLLBACK');
			throw e;
		}
	}
}

migrate();
if (!BUILDING) backupOnNewVersion(db);

export function getSetting(key: string): string | undefined {
	return get<{ value: string }>('SELECT value FROM settings WHERE key = ?', key)?.value;
}

export function setSetting(key: string, value: string) {
	run(
		'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
		[key, value]
	);
}

process.on('sveltekit:shutdown', () => {
	try {
		db.close();
	} catch {
		// already closed
	}
});
