// Site-wide settings and the people who run the site. The first account (made with the setup
// code) is an admin, and admins can make others admins from the Admin page.
import { error } from '@sveltejs/kit';
import { all, get, getSetting, now, run, setSetting, transaction } from './db';
import { auth } from './auth';
import { isTheme, type ThemeId } from '#lib/themes.js';

export function siteTheme(): ThemeId {
	const t = getSetting('site_theme');
	return isTheme(t) ? t : 'programme';
}

export function setSiteTheme(theme: ThemeId) {
	setSetting('site_theme', theme);
}

// ---- Admins ------------------------------------------------------------------

export function isSiteAdmin(userId: string) {
	return !!get('SELECT 1 FROM site_admins WHERE user_id = ?', userId);
}

/** For admin pages and actions: 404 for everyone else, so the page isn't advertised. */
export function requireAdmin(userId: string) {
	if (!isSiteAdmin(userId)) error(404, 'Not found');
}

export function makeAdmin(userId: string) {
	run('INSERT OR IGNORE INTO site_admins (user_id, added_at) VALUES (?, ?)', [userId, now()]);
}

/** Returns false rather than leave the site with no admin. */
export function removeAdmin(userId: string) {
	return transaction(() => {
		const n = get<{ n: number }>('SELECT COUNT(*) AS n FROM site_admins')!.n;
		if (n <= 1 && isSiteAdmin(userId)) return false;
		run('DELETE FROM site_admins WHERE user_id = ?', userId);
		return true;
	});
}

// ---- Users -------------------------------------------------------------------

export interface SiteUser {
	id: string;
	name: string;
	email: string;
	joinedAt: string;
	lastSeenAt: string | null;
	admin: boolean;
	ownedLists: number;
	sharedLists: number; // lists they own that other people are members of
	memberOf: number; // other people's lists they belong to
	items: number;
}

// better-auth may store dates as ISO strings or epoch milliseconds.
const iso = (v: unknown) => {
	if (v === null || v === undefined) return null;
	const d = new Date(typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : (v as string));
	return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export function siteUsers(): SiteUser[] {
	const rows = all<{
		id: string;
		name: string;
		email: string;
		createdAt: unknown;
		lastSeen: unknown;
		admin: number;
		ownedLists: number;
		sharedLists: number;
		memberOf: number;
		items: number;
	}>(
		`SELECT u.id, u.name, u.email, u."createdAt",
			(SELECT MAX(s."updatedAt") FROM "session" s WHERE s."userId" = u.id) AS lastSeen,
			EXISTS (SELECT 1 FROM site_admins a WHERE a.user_id = u.id) AS admin,
			(SELECT COUNT(*) FROM lists l WHERE l.owner_id = u.id) AS ownedLists,
			(SELECT COUNT(*) FROM lists l WHERE l.owner_id = u.id
				AND EXISTS (SELECT 1 FROM list_members m WHERE m.list_id = l.id AND m.user_id <> u.id))
				AS sharedLists,
			(SELECT COUNT(*) FROM list_members m WHERE m.user_id = u.id AND m.role <> 'owner')
				AS memberOf,
			(SELECT COUNT(*) FROM items i WHERE i.added_by = u.id) AS items
		 FROM "user" u
		 ORDER BY u."createdAt", u.rowid`
	);
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		email: r.email,
		joinedAt: iso(r.createdAt) ?? '',
		lastSeenAt: iso(r.lastSeen),
		admin: !!r.admin,
		ownedLists: r.ownedLists,
		sharedLists: r.sharedLists,
		memberOf: r.memberOf,
		items: r.items
	}));
}

export function userExists(userId: string) {
	return !!get('SELECT 1 FROM "user" WHERE id = ?', userId);
}

/** Signs someone out on every device. */
export function signOutEverywhere(userId: string) {
	run('DELETE FROM "session" WHERE "userId" = ?', userId);
}

/** Sets a new password for someone (e.g. they forgot theirs) and signs them out everywhere. */
export async function setUserPassword(userId: string, password: string) {
	const ctx = await auth.$context;
	const hash = await ctx.password.hash(password);
	const res = run(
		`UPDATE "account" SET "password" = ?, "updatedAt" = ? WHERE "userId" = ? AND "providerId" = 'credential'`,
		[hash, new Date().toISOString(), userId]
	);
	if (res.changes === 0) return false;
	signOutEverywhere(userId);
	return true;
}

/**
 * Deletes an account. Lists they own that other people use go to the longest-standing other
 * member rather than disappearing; lists only they use are deleted with them.
 */
export function deleteUser(userId: string) {
	transaction(() => {
		const shared = all<{ list_id: number; heir: string }>(
			`SELECT l.id AS list_id,
				(SELECT m.user_id FROM list_members m WHERE m.list_id = l.id AND m.user_id <> l.owner_id
				 ORDER BY m.joined_at LIMIT 1) AS heir
			 FROM lists l WHERE l.owner_id = ?`,
			userId
		).filter((r) => r.heir);
		for (const { list_id, heir } of shared) {
			run('UPDATE lists SET owner_id = ? WHERE id = ?', [heir, list_id]);
			run("UPDATE list_members SET role = 'owner' WHERE list_id = ? AND user_id = ?", [
				list_id,
				heir
			]);
		}
		run('DELETE FROM "user" WHERE id = ?', userId);
	});
}
