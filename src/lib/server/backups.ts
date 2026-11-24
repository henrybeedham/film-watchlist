// Automatic SQLite backups: before every migration and once per new app version.
import type { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './config';
import { version } from '$app/env';

const BACKUP_DIR = join(DATA_DIR, 'backups');
const KEEP = 10;

function stamp() {
	return new Date().toISOString().slice(0, 19).replace(/:/g, '-');
}

function backup(db: DatabaseSync, label: string) {
	mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
	const path = join(BACKUP_DIR, `auto-${stamp()}-${label}.db`);
	db.exec(`VACUUM INTO '${path.replace(/'/g, "''")}'`);
	console.log(`[backup] Saved ${path}`);
	prune();
}

function prune() {
	const auto = readdirSync(BACKUP_DIR)
		.filter((f) => f.startsWith('auto-') && f.endsWith('.db'))
		.sort()
		.reverse();
	for (const old of auto.slice(KEEP)) rmSync(join(BACKUP_DIR, old));
}

export function backupBeforeMigrating(db: DatabaseSync, schemaVersion: number) {
	backup(db, `v${schemaVersion}`);
}

/** One backup per deploy: compare the build version with the last one we saw. */
export function backupOnNewVersion(db: DatabaseSync) {
	const row = db.prepare("SELECT value FROM settings WHERE key = 'app_version'").get() as
		{ value: string } | undefined;
	if (row?.value === version) return;
	const hasData = db.prepare('SELECT 1 FROM "user" LIMIT 1').get();
	if (row && hasData) backup(db, `app-${version.replace(/[^\w.-]/g, '')}`);
	db.prepare(
		"INSERT INTO settings (key, value) VALUES ('app_version', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value"
	).run(version);
}
