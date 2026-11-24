// Titles on a list, their watched diary, and how they're added, edited and ticked off.
import { error } from '@sveltejs/kit';
import { all, get, now, placeholders, run, transaction } from './db';
import { titleFromRow } from './tmdb';
import { titleKey } from '#lib/notes-parser.js';
import { todayIso } from '#lib/format.js';
import type { DiaryEntry, Item, MatchStatus, MediaType } from '#lib/types.js';

const UNRELEASED = new Set(['Planned', 'In Production', 'Post Production', 'Rumored']);

interface ItemRow {
	id: number;
	list_id: number;
	title: string;
	media_type: MediaType | null;
	tmdb_id: number | null;
	match_status: MatchStatus;
	kind_hint: MediaType | null;
	year_hint: number | null;
	mentions: number;
	recommended_by: string | null;
	note: string | null;
	release_override: string | null;
	status: 'want' | 'watched';
	watched_at: string | null;
	added_by: string | null;
	added_by_name: string | null;
	created_at: string;
	// joined from titles (prefixed t_)
	t_title: string | null;
	t_original_title: string | null;
	t_release_date: string | null;
	t_status: string | null;
	t_runtime: number | null;
	t_seasons: number | null;
	t_genres: string | null;
	t_overview: string | null;
	t_poster_path: string | null;
	t_backdrop_path: string | null;
	t_providers: string | null;
	t_details_at: string | null;
	t_providers_at: string | null;
}

const SELECT = `
	SELECT i.*, u.name AS added_by_name,
		t.title AS t_title, t.original_title AS t_original_title, t.release_date AS t_release_date,
		t.status AS t_status, t.runtime AS t_runtime, t.seasons AS t_seasons, t.genres AS t_genres,
		t.overview AS t_overview, t.poster_path AS t_poster_path, t.backdrop_path AS t_backdrop_path,
		t.providers AS t_providers, t.details_at AS t_details_at, t.providers_at AS t_providers_at
	FROM items i
	LEFT JOIN titles t ON t.media_type = i.media_type AND t.tmdb_id = i.tmdb_id
	LEFT JOIN "user" u ON u.id = i.added_by`;

function toItem(r: ItemRow, diary: DiaryEntry[]): Item {
	const details =
		r.t_title !== null && r.media_type && r.tmdb_id
			? titleFromRow({
					media_type: r.media_type,
					tmdb_id: r.tmdb_id,
					title: r.t_title,
					original_title: r.t_original_title,
					release_date: r.t_release_date,
					status: r.t_status,
					runtime: r.t_runtime,
					seasons: r.t_seasons,
					genres: r.t_genres ?? '[]',
					overview: r.t_overview,
					poster_path: r.t_poster_path,
					backdrop_path: r.t_backdrop_path,
					providers: r.t_providers,
					details_at: r.t_details_at,
					providers_at: r.t_providers_at
				})
			: null;
	const releaseDate = r.release_override ?? details?.releaseDate ?? null;
	const comingSoon =
		r.status === 'want' &&
		(releaseDate
			? releaseDate > todayIso()
			: !!details && details.mediaType === 'movie' && UNRELEASED.has(details.status ?? ''));
	return {
		id: r.id,
		listId: r.list_id,
		title: r.title,
		displayTitle: details?.title || r.title,
		mediaType: r.media_type ?? r.kind_hint,
		tmdbId: r.tmdb_id,
		matchStatus: r.match_status,
		kindHint: r.kind_hint,
		yearHint: r.year_hint,
		mentions: r.mentions,
		recommendedBy: r.recommended_by,
		note: r.note,
		releaseOverride: r.release_override,
		releaseDate,
		comingSoon,
		status: r.status,
		watchedAt: r.watched_at,
		addedBy: r.added_by,
		addedByName: r.added_by_name,
		createdAt: r.created_at,
		details,
		diary
	};
}

function diaryFor(itemIds: number[]): Map<number, DiaryEntry[]> {
	const map = new Map<number, DiaryEntry[]>();
	if (itemIds.length === 0) return map;
	// Chunk to stay well under SQLite's variable limit.
	for (let i = 0; i < itemIds.length; i += 500) {
		const chunk = itemIds.slice(i, i + 500);
		const rows = all<DiaryEntry>(
			`SELECT d.id, d.item_id AS itemId, d.user_id AS userId, u.name AS userName,
				d.watched_on AS watchedOn, d.rating, d.review, d.created_at AS createdAt
			 FROM diary d JOIN "user" u ON u.id = d.user_id
			 WHERE d.item_id IN (${placeholders(chunk.length)})
			 ORDER BY COALESCE(d.watched_on, d.created_at) DESC`,
			chunk
		);
		for (const row of rows) {
			const list = map.get(row.itemId) ?? [];
			list.push(row);
			map.set(row.itemId, list);
		}
	}
	return map;
}

export function listItems(listId: number, status?: 'want' | 'watched'): Item[] {
	const rows = all<ItemRow>(
		`${SELECT} WHERE i.list_id = ? ${status ? 'AND i.status = ?' : ''} ORDER BY i.created_at DESC, i.id DESC`,
		status ? [listId, status] : [listId]
	);
	const diary = diaryFor(rows.map((r) => r.id));
	return rows.map((r) => toItem(r, diary.get(r.id) ?? []));
}

export function getItem(id: number): Item | undefined {
	const row = get<ItemRow>(`${SELECT} WHERE i.id = ?`, id);
	return row ? toItem(row, diaryFor([id]).get(id) ?? []) : undefined;
}

/** Loads an item and checks it belongs to the given list. */
export function requireItem(id: number, listIds: number[]): Item {
	const item = Number.isInteger(id) ? getItem(id) : undefined;
	if (!item || !listIds.includes(item.listId)) error(404, 'That title isn’t on any of your lists.');
	return item;
}

export interface NewItem {
	title: string;
	yearHint?: number | null;
	kindHint?: MediaType | null;
	mentions?: number;
	recommendedBy?: string | null;
	note?: string | null;
	/** When the person picked a specific TMDB result. */
	tmdb?: { mediaType: MediaType; tmdbId: number } | null;
}

export function addItems(listId: number, userId: string, items: NewItem[]) {
	return transaction(() => {
		const t = now();
		const ids: number[] = [];
		for (const it of items) {
			const res = run(
				`INSERT INTO items (list_id, title, media_type, tmdb_id, match_status, kind_hint, year_hint,
					mentions, recommended_by, note, status, added_by, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					listId,
					it.title.trim().slice(0, 200),
					it.tmdb?.mediaType ?? null,
					it.tmdb?.tmdbId ?? null,
					it.tmdb ? 'matched' : 'pending',
					it.kindHint ?? null,
					it.yearHint ?? null,
					Math.max(1, Math.min(99, Math.round(it.mentions ?? 1) || 1)),
					it.recommendedBy?.trim().slice(0, 100) || null,
					it.note?.trim().slice(0, 1000) || null,
					'want',
					userId,
					t,
					t
				]
			);
			ids.push(Number(res.lastInsertRowid));
		}
		return ids;
	});
}

/** Existing items on a list, keyed for duplicate checks. */
export function existingKeys(listId: number) {
	const rows = all<{ id: number; title: string; t_title: string | null; status: string }>(
		`SELECT i.id, i.title, t.title AS t_title, i.status FROM items i
		 LEFT JOIN titles t ON t.media_type = i.media_type AND t.tmdb_id = i.tmdb_id
		 WHERE i.list_id = ?`,
		listId
	);
	const map = new Map<string, { id: number; title: string; status: string }>();
	for (const r of rows) {
		const entry = { id: r.id, title: r.t_title ?? r.title, status: r.status };
		map.set(titleKey(r.title), entry);
		if (r.t_title) map.set(titleKey(r.t_title), entry);
	}
	return map;
}

export function findOnListByTmdb(listId: number, mediaType: MediaType, tmdbId: number) {
	return get<{ id: number }>(
		'SELECT id FROM items WHERE list_id = ? AND media_type = ? AND tmdb_id = ?',
		[listId, mediaType, tmdbId]
	);
}

export function bumpMentions(id: number, by = 1) {
	run('UPDATE items SET mentions = MAX(1, MIN(99, mentions + ?)), updated_at = ? WHERE id = ?', [
		by,
		now(),
		id
	]);
}

export interface ItemEdit {
	title: string;
	recommendedBy: string | null;
	note: string | null;
	mentions: number;
	releaseOverride: string | null;
	kindHint: MediaType | null;
}

export function updateItem(id: number, e: ItemEdit) {
	run(
		`UPDATE items SET title = ?, recommended_by = ?, note = ?, mentions = ?, release_override = ?,
			kind_hint = ?, updated_at = ? WHERE id = ?`,
		[
			e.title.trim().slice(0, 200),
			e.recommendedBy?.trim().slice(0, 100) || null,
			e.note?.trim().slice(0, 1000) || null,
			Math.max(1, Math.min(99, Math.round(e.mentions) || 1)),
			e.releaseOverride || null,
			e.kindHint,
			now(),
			id
		]
	);
}

export function setMatch(id: number, match: { mediaType: MediaType; tmdbId: number } | null) {
	run(
		'UPDATE items SET media_type = ?, tmdb_id = ?, match_status = ?, updated_at = ? WHERE id = ?',
		[match?.mediaType ?? null, match?.tmdbId ?? null, match ? 'matched' : 'none', now(), id]
	);
}

export function deleteItem(id: number) {
	run('DELETE FROM items WHERE id = ?', id);
}

export interface WatchLog {
	watchedOn: string | null;
	rating: number | null;
	review: string | null;
}

export function markWatched(id: number, userId: string, log: WatchLog | null) {
	transaction(() => {
		run(
			"UPDATE items SET status = 'watched', watched_at = COALESCE(?, watched_at, ?), updated_at = ? WHERE id = ?",
			[log?.watchedOn ?? null, todayIso(), now(), id]
		);
		if (log) addDiary(id, userId, log);
	});
}

export function addDiary(id: number, userId: string, log: WatchLog) {
	run(
		'INSERT INTO diary (item_id, user_id, watched_on, rating, review, created_at) VALUES (?, ?, ?, ?, ?, ?)',
		[id, userId, log.watchedOn, log.rating, log.review?.trim().slice(0, 4000) || null, now()]
	);
}

export function deleteDiary(diaryId: number, userId: string) {
	run('DELETE FROM diary WHERE id = ? AND user_id = ?', [diaryId, userId]);
}

export function markUnwatched(id: number) {
	run("UPDATE items SET status = 'want', watched_at = NULL, updated_at = ? WHERE id = ?", [
		now(),
		id
	]);
}

export function pendingCount(listId: number) {
	return get<{ n: number }>(
		"SELECT COUNT(*) AS n FROM items WHERE list_id = ? AND match_status = 'pending'",
		listId
	)!.n;
}
