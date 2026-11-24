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

export function revokeInvite(listId: number, t: string) {
	run('DELETE FROM invites WHERE token = ? AND list_id = ?', [t, listId]);
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
		if (invite.listId !== null) {
			addMember(invite.listId, userId);
			cancelRequest(invite.listId, userId);
		}
		run('UPDATE invites SET used_at = ?, used_by = ? WHERE token = ?', [now(), userId, t]);
		return { listId: invite.listId };
	});
}

// ---- Invites to people who already have an account ------------------------

/** Site users who aren't on the list and haven't already been asked to join it. */
export function invitableUsers(listId: number) {
	return all<{ id: string; name: string; email: string }>(
		`SELECT u.id, u.name, u.email FROM "user" u
		 WHERE u.id NOT IN (SELECT user_id FROM list_members WHERE list_id = ?)
		   AND u.id NOT IN (SELECT user_id FROM list_requests WHERE list_id = ?)
		 ORDER BY u.name COLLATE NOCASE`,
		[listId, listId]
	);
}

/** Asks an existing user to join; false if there's no such user or they're already on it. */
export function inviteUser(listId: number, invitedBy: string, userId: string) {
	return transaction(() => {
		if (!get('SELECT 1 FROM "user" WHERE id = ?', userId) || roleIn(listId, userId)) return false;
		run(
			`INSERT INTO list_requests (list_id, user_id, invited_by, created_at) VALUES (?, ?, ?, ?)
			 ON CONFLICT DO NOTHING`,
			[listId, userId, invitedBy, now()]
		);
		return true;
	});
}

/** Who the owner is waiting on. */
export function pendingForList(listId: number) {
	return all<{ userId: string; name: string; email: string; createdAt: string }>(
		`SELECT u.id AS userId, u.name, u.email, r.created_at AS createdAt
		 FROM list_requests r JOIN "user" u ON u.id = r.user_id
		 WHERE r.list_id = ? ORDER BY r.created_at`,
		listId
	);
}

/** Lists this person has been asked to join. */
export function pendingForUser(userId: string) {
	return all<{ listId: number; listName: string; invitedBy: string }>(
		`SELECT l.id AS listId, l.name AS listName, u.name AS invitedBy
		 FROM list_requests r JOIN lists l ON l.id = r.list_id JOIN "user" u ON u.id = r.invited_by
		 WHERE r.user_id = ? ORDER BY r.created_at`,
		userId
	);
}

export function cancelRequest(listId: number, userId: string) {
	run('DELETE FROM list_requests WHERE list_id = ? AND user_id = ?', [listId, userId]);
}

/** Accepts or declines; false if there was no such invitation. */
export function answerRequest(listId: number, userId: string, accept: boolean) {
	return transaction(() => {
		const found = run('DELETE FROM list_requests WHERE list_id = ? AND user_id = ?', [
			listId,
			userId
		]).changes;
		if (!found) return false;
		if (accept) addMember(listId, userId);
		return true;
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
