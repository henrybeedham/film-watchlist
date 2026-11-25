import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiUser } from '#lib/server/guard.js';
import { userLists } from '#lib/server/lists.js';
import { requireItem } from '#lib/server/items.js';
import { findMagnets, itemQuery, MAGNETS_ENABLED, textQuery } from '#lib/server/magnets.js';
import { hit } from '#lib/server/rate-limit.js';
import { can } from '#lib/server/site.js';

/** `?item=<id>` searches for a title on one of your lists; `?q=…&type=movie|tv` for any text. */
export const GET: RequestHandler = async ({ locals, url }) => {
	const user = requireApiUser(locals);
	if (!MAGNETS_ENABLED || !can(user.id, 'magnets')) error(404, 'Not found');
	const itemId = url.searchParams.get('item');
	const search = itemId
		? itemQuery(
				requireItem(
					Number(itemId),
					userLists(user.id).map((l) => l.id)
				)
			)
		: textQuery(
				url.searchParams.get('q') ?? '',
				url.searchParams.get('type') === 'tv' ? 'tv' : 'movie'
			);
	if (search.query.length < 2) error(400, 'Type a title to search for.');
	// Each search starts a process and asks several indexes; a few a minute is plenty.
	if (!hit(`magnets:${user.id}`, 10, 60)) error(429, 'Too many searches. Wait a minute.');
	try {
		return json({ query: search.query, results: await findMagnets(search) });
	} catch (e) {
		console.warn('[magnets] search failed:', (e as Error).message);
		error(502, 'None of the torrent indexes answered. Try again in a moment.');
	}
};
