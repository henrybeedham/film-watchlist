// Background lookups: matches new titles on TMDB and keeps details and streaming info fresh.
import { all, run, now } from './db';
import { bestMatch, ensureDetails, fetchDetails, TMDB_ENABLED } from './tmdb';
import type { MediaType } from '#lib/types.js';

const CONCURRENCY = 4;
const REFRESH_EVERY = 1000 * 60 * 60; // hourly sweep for stale streaming info

let running = false;
let again = false;

interface Pending {
	id: number;
	title: string;
	kind_hint: MediaType | null;
	year_hint: number | null;
	media_type: MediaType | null;
	tmdb_id: number | null;
}

async function matchOne(item: Pending) {
	try {
		if (item.media_type && item.tmdb_id) {
			// Picked from search results when added: just fetch the details.
			await fetchDetails(item.media_type, item.tmdb_id);
			run("UPDATE items SET match_status = 'matched' WHERE id = ?", item.id);
			return;
		}
		const match = await bestMatch(item.title, item.kind_hint, item.year_hint);
		if (!match) {
			run("UPDATE items SET match_status = 'none', updated_at = ? WHERE id = ?", [now(), item.id]);
			return;
		}
		await fetchDetails(match.mediaType, match.tmdbId);
		run(
			'UPDATE items SET media_type = ?, tmdb_id = ?, match_status = ?, updated_at = ? WHERE id = ?',
			[match.mediaType, match.tmdbId, match.exact ? 'matched' : 'guess', now(), item.id]
		);
	} catch (e) {
		// Leave it pending; the next sweep retries.
		console.warn(`[enrich] "${item.title}":`, (e as Error).message);
		throw e;
	}
}

async function drain() {
	let failures = 0;
	for (;;) {
		const batch = all<Pending>(
			`SELECT id, title, kind_hint, year_hint, media_type, tmdb_id FROM items
			 WHERE match_status = 'pending' ORDER BY id LIMIT ?`,
			CONCURRENCY * 4
		);
		if (batch.length === 0) return;
		for (let i = 0; i < batch.length; i += CONCURRENCY) {
			const results = await Promise.allSettled(batch.slice(i, i + CONCURRENCY).map(matchOne));
			failures += results.filter((r) => r.status === 'rejected').length;
		}
		// TMDB unreachable or the key is wrong: stop and try again on the next sweep.
		if (failures >= 8) return;
	}
}

/** Starts matching pending items in the background. Safe to call often. */
export function kickEnrichment() {
	if (!TMDB_ENABLED) return;
	if (running) {
		again = true;
		return;
	}
	running = true;
	void (async () => {
		try {
			do {
				again = false;
				await drain();
			} while (again);
		} finally {
			running = false;
		}
	})();
}

async function refreshStale() {
	const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString();
	for (let round = 0; round < 20; round++) {
		const stale = all<{ media_type: MediaType; tmdb_id: number }>(
			`SELECT DISTINCT t.media_type, t.tmdb_id FROM titles t
			 JOIN items i ON i.media_type = t.media_type AND i.tmdb_id = t.tmdb_id AND i.status = 'want'
			 WHERE t.providers_at IS NULL OR t.providers_at < ?
			 LIMIT 20`,
			cutoff
		);
		if (stale.length === 0) return;
		for (const t of stale) await ensureDetails(t.media_type, t.tmdb_id);
	}
}

let started = false;
export function startEnrichment() {
	if (started || !TMDB_ENABLED) return;
	started = true;
	kickEnrichment();
	void refreshStale();
	const timer = setInterval(() => {
		kickEnrichment();
		void refreshStale();
	}, REFRESH_EVERY);
	timer.unref();
	process.on('sveltekit:shutdown', () => clearInterval(timer));
}
