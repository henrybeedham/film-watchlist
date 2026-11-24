// Saves films read from a Letterboxd export onto a list, with the importer's diary.
import { all, get, now, run, transaction } from './db';
import { titleKey } from '#lib/notes-parser.js';
import { todayIso } from '#lib/format.js';
import type { LetterboxdEntry } from '#lib/letterboxd.js';

export interface ImportFilm {
	title: string;
	year: number | null;
	status: 'want' | 'watched';
	addedOn: string | null;
	watchedOn: string | null;
	entries: LetterboxdEntry[];
	/** A title already on the list to mark watched and log against, instead of adding a new one. */
	existingId: number | null;
}

/** Titles already on a list, with a year where one's known, for spotting films already there. */
export function listTitlesForImport(listId: number) {
	const rows = all<{
		id: number;
		title: string;
		t_title: string | null;
		year: string | null;
		status: 'want' | 'watched';
	}>(
		`SELECT i.id, i.title, t.title AS t_title, i.status,
			COALESCE(substr(t.release_date, 1, 4), i.year_hint) AS year
		 FROM items i
		 LEFT JOIN titles t ON t.media_type = i.media_type AND t.tmdb_id = i.tmdb_id
		 WHERE i.list_id = ?`,
		listId
	);
	return rows.map((r) => ({
		id: r.id,
		title: r.t_title ?? r.title,
		keys: [...new Set([titleKey(r.title), ...(r.t_title ? [titleKey(r.t_title)] : [])])],
		year: Number(r.year) || null,
		status: r.status
	}));
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const date = (s: unknown) => (typeof s === 'string' && DATE.test(s) ? s : null);
const str = (s: unknown, max: number) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

/** Checks one film sent from the browser; anything malformed is dropped. */
export function cleanFilm(raw: unknown): ImportFilm | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const title = str(r.title, 200);
	if (!title) return null;
	const year = Number(r.year);
	const entries = (Array.isArray(r.entries) ? r.entries : []).slice(0, 200).flatMap((e) => {
		if (!e || typeof e !== 'object') return [];
		const x = e as Record<string, unknown>;
		const rating = Number(x.rating);
		return [
			{
				watchedOn: date(x.watchedOn),
				rating: Number.isInteger(rating) && rating >= 1 && rating <= 10 ? rating : null,
				review: str(x.review, 4000) || null
			}
		];
	});
	const existingId = Number(r.existingId);
	return {
		title,
		year: Number.isInteger(year) && year > 1880 && year < 2100 ? year : null,
		status: r.status === 'watched' ? 'watched' : 'want',
		addedOn: date(r.addedOn),
		watchedOn: date(r.watchedOn),
		entries: r.status === 'watched' ? entries : [],
		existingId: Number.isSafeInteger(existingId) && existingId > 0 ? existingId : null
	};
}

export function importFilms(listId: number, userId: string, films: ImportFilm[]) {
	return transaction(() => {
		const t = now();
		let added = 0;
		let updated = 0;
		let logged = 0;

		const logEntries = (itemId: number, entries: LetterboxdEntry[]) => {
			for (const e of entries) {
				// Importing the same export twice shouldn't log every viewing twice.
				const dupe = get(
					`SELECT 1 FROM diary WHERE item_id = ? AND user_id = ? AND watched_on IS ?
						AND rating IS ? AND review IS ?`,
					[itemId, userId, e.watchedOn, e.rating, e.review]
				);
				if (dupe) continue;
				run(
					'INSERT INTO diary (item_id, user_id, watched_on, rating, review, created_at) VALUES (?, ?, ?, ?, ?, ?)',
					[itemId, userId, e.watchedOn, e.rating, e.review, t]
				);
				logged++;
			}
		};

		for (const f of films) {
			const existing = f.existingId
				? get<{ id: number; status: string }>(
						'SELECT id, status FROM items WHERE id = ? AND list_id = ?',
						[f.existingId, listId]
					)
				: undefined;

			if (existing) {
				if (f.status !== 'watched') continue;
				if (existing.status !== 'watched') {
					run("UPDATE items SET status = 'watched', watched_at = ?, updated_at = ? WHERE id = ?", [
						f.watchedOn ?? f.addedOn ?? todayIso(),
						t,
						existing.id
					]);
				}
				logEntries(existing.id, f.entries);
				updated++;
				continue;
			}

			// Dated by when it went on the Letterboxd watchlist (or was seen), so the list keeps
			// Letterboxd's order rather than putting the whole import at the top.
			const day = f.addedOn ?? f.watchedOn;
			const created = day ? `${day}T12:00:00.000Z` : t;
			const res = run(
				`INSERT INTO items (list_id, title, match_status, kind_hint, year_hint, status, watched_at,
					added_by, created_at, updated_at)
				 VALUES (?, ?, 'pending', 'movie', ?, ?, ?, ?, ?, ?)`,
				[
					listId,
					f.title,
					f.year,
					f.status,
					f.status === 'watched' ? (f.watchedOn ?? f.addedOn ?? todayIso()) : null,
					userId,
					created,
					t
				]
			);
			if (f.status === 'watched') logEntries(Number(res.lastInsertRowid), f.entries);
			added++;
		}
		return { added, updated, logged };
	});
}
