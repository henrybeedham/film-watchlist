// Lists, who belongs to them, invite links and public share links.
import { error } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { all, get, now, run, transaction } from './db';
import type { ListSummary } from '#lib/types.js';

const INVITE_DAYS = 7;
const token = () => randomBytes(18).toString('base64url');

export interface ListRow {
	id: number;
	name: string;
	owner_id: string;
	share_token: string | null;
	created_at: string;
}

export function userLists(userId: string): ListSummary[] {
	return all<ListSummary>(
		`SELECT l.id, l.name, m.role, u.name AS ownerName,
			(SELECT COUNT(*) FROM items i WHERE i.list_id = l.id AND i.status = 'want') AS wantCount
		 FROM list_members m
		 JOIN lists l ON l.id = m.list_id
		 JOIN "user" u ON u.id = l.owner_id
		 WHERE m.user_id = ?
		 ORDER BY l.created_at`,
		userId
	);
}

export function roleIn(listId: number, userId: string) {
	return get<{ role: 'owner' | 'editor' }>(
		'SELECT role FROM list_members WHERE list_id = ? AND user_id = ?',
		[listId, userId]
	)?.role;
}

/** Throws 404 unless the user belongs to the list. */
export function requireMember(listId: number, userId: string) {
	const role = roleIn(listId, userId);
	if (!role) error(404, 'That list doesn’t exist, or you’re not a member of it.');
	return role;
}

export function requireOwner(listId: number, userId: string) {
	if (requireMember(listId, userId) !== 'owner') error(403, 'Only the list’s owner can do that.');
}

export function getList(listId: number) {
	return get<ListRow>('SELECT * FROM lists WHERE id = ?', listId);
}

export function createList(userId: string, name: string) {
	return transaction(() => {
		const t = now();
		const id = Number(
			run('INSERT INTO lists (name, owner_id, created_at) VALUES (?, ?, ?)', [name, userId, t])
				.lastInsertRowid
		);
		run('INSERT INTO list_members (list_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)', [
			id,
			userId,
			'owner',
			t
		]);
		return id;
	});
}

export function renameList(listId: number, name: string) {
	run('UPDATE lists SET name = ? WHERE id = ?', [name, listId]);
}

export function deleteList(listId: number) {
	run('DELETE FROM lists WHERE id = ?', listId);
}

export function members(listId: number) {
	return all<{ userId: string; name: string; email: string; role: 'owner' | 'editor' }>(
		`SELECT u.id AS userId, u.name, u.email, m.role
		 FROM list_members m JOIN "user" u ON u.id = m.user_id
		 WHERE m.list_id = ? ORDER BY m.role DESC, m.joined_at`,
		listId
	);
}

export function removeMember(listId: number, userId: string) {
	run("DELETE FROM list_members WHERE list_id = ? AND user_id = ? AND role != 'owner'", [
		listId,
		userId
	]);
}

export function addMember(listId: number, userId: string) {
	run(
		`INSERT INTO list_members (list_id, user_id, role, joined_at) VALUES (?, ?, 'editor', ?)
		 ON CONFLICT DO NOTHING`,
		[listId, userId, now()]
	);
}

// ---- Invites ---------------------------------------------------------------

/** An invite to a list, or with `listId` null, just to the site. */
export function createInvite(listId: number | null, userId: string) {
	const t = token();
	const expires = new Date(Date.now() + INVITE_DAYS * 864e5).toISOString();
	run(
		'INSERT INTO invites (token, list_id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
		[t, listId, userId, now(), expires]
	);
	return t;
}

interface OpenInvite {
	token: string;
	createdAt: string;
	expiresAt: string;
	createdBy: string;
}

export function openInvites(listId: number) {
	return all<OpenInvite>(
		`SELECT i.token, i.created_at AS createdAt, i.expires_at AS expiresAt, u.name AS createdBy
		 FROM invites i JOIN "user" u ON u.id = i.created_by
		 WHERE i.list_id = ? AND i.used_at IS NULL AND i.expires_at > ?
		 ORDER BY i.created_at DESC`,
		[listId, now()]
	);
}

/** Someone's open invites to the site that don't come with a list. */
export function openSiteInvites(userId: string) {
	return all<OpenInvite>(
		`SELECT i.token, i.created_at AS createdAt, i.expires_at AS expiresAt, u.name AS createdBy
		 FROM invites i JOIN "user" u ON u.id = i.created_by
		 WHERE i.list_id IS NULL AND i.created_by = ? AND i.used_at IS NULL AND i.expires_at > ?
		 ORDER BY i.created_at DESC`,
		[userId, now()]
	);
}

export function revokeInvite(listId: number, t: string) {
	run('DELETE FROM invites WHERE token = ? AND list_id = ?', [t, listId]);
}

export function revokeSiteInvite(userId: string, t: string) {
	run('DELETE FROM invites WHERE token = ? AND list_id IS NULL AND created_by = ?', [t, userId]);
}

/** A valid, unused invite and the list it's for (null for a site-only invite). */
export function findInvite(t: string) {
	return get<{ token: string; listId: number | null; listName: string | null; invitedBy: string }>(
		`SELECT i.token, i.list_id AS listId, l.name AS listName, u.name AS invitedBy
		 FROM invites i LEFT JOIN lists l ON l.id = i.list_id JOIN "user" u ON u.id = i.created_by
		 WHERE i.token = ? AND i.used_at IS NULL AND i.expires_at > ?`,
		[t, now()]
	);
}

/** Uses up the invite; false if it's gone, otherwise the list joined (null for a site invite). */
export function useInvite(t: string, userId: string): false | { listId: number | null } {
	return transaction(() => {
		const invite = findInvite(t);
		if (!invite) return false;
		if (invite.listId !== null) addMember(invite.listId, userId);
		run('UPDATE invites SET used_at = ?, used_by = ? WHERE token = ?', [now(), userId, t]);
		return { listId: invite.listId };
	});
}

// ---- Public share links -----------------------------------------------------

export function setShareToken(listId: number, on: boolean) {
	run('UPDATE lists SET share_token = ? WHERE id = ?', [on ? token() : null, listId]);
}

export function listByShareToken(t: string) {
	if (!t || t.length < 10) return undefined;
	return get<ListRow & { owner_name: string }>(
		`SELECT l.*, u.name AS owner_name FROM lists l JOIN "user" u ON u.id = l.owner_id
		 WHERE l.share_token = ?`,
		t
	);
}

export function userCount() {
	return get<{ n: number }>('SELECT COUNT(*) AS n FROM "user"')!.n;
}
