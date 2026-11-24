import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiUser } from '#lib/server/guard.js';
import { searchResults, TMDB_ENABLED } from '#lib/server/tmdb.js';
import { hit } from '#lib/server/rate-limit.js';

export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requireApiUser(locals);
	// Search-as-you-type is a few requests a second at most; this protects the TMDB quota.
	if (!hit(`tmdb-search:${user.id}`, 120, 60)) return json([], { status: 429 });
	const q = (url.searchParams.get('q') ?? '').trim().slice(0, 120);
	if (!TMDB_ENABLED || q.length < 2) return json([]);
	try {
		return json(await searchResults(q), { headers: { 'cache-control': 'private, max-age=300' } });
	} catch (e) {
		console.warn('[tmdb] search failed:', (e as Error).message);
		return json([], { status: 502 });
	}
};
