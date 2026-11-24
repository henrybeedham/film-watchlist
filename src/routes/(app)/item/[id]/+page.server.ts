import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { appContext, listContext } from '#lib/server/context.js';
import { deleteItem, getItem, requireItem, setMatch, updateItem } from '#lib/server/items.js';
import { isTmdbId, itemActions } from '#lib/server/item-actions.js';
import { ensureDetails, fetchDetails, isStale, TMDB_ENABLED } from '#lib/server/tmdb.js';
import type { MediaType } from '#lib/types.js';
import { text } from '#lib/server/form.js';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const { listIds, lists } = appContext(locals, url);
	let item = requireItem(Number(params.id), listIds);
	if (TMDB_ENABLED && item.mediaType && item.tmdbId && item.matchStatus !== 'pending') {
		if (!item.details) {
			await ensureDetails(item.mediaType, item.tmdbId);
			item = getItem(item.id)!;
		} else if (isStale(item.mediaType, item.tmdbId)) {
			void ensureDetails(item.mediaType, item.tmdbId); // fresh data next visit
		}
	}
	return { item, listName: lists.find((l) => l.id === item.listId)?.name ?? '' };
};

const str = (f: FormData, k: string) => text(f, k).trim();

export const actions: Actions = {
	...itemActions,

	edit: async ({ request, locals, params }) => {
		const { listIds } = listContext(locals);
		const item = requireItem(Number(params.id), listIds);
		const f = await request.formData();
		const title = str(f, 'title');
		if (!title) return fail(400, { message: 'The title can’t be empty.' });
		const release = str(f, 'releaseOverride');
		const kind = str(f, 'kindHint');
		updateItem(item.id, {
			title,
			recommendedBy: str(f, 'recommendedBy') || null,
			note: str(f, 'note') || null,
			mentions: Number(str(f, 'mentions')) || 1,
			releaseOverride: /^\d{4}-\d{2}-\d{2}$/.test(release) ? release : null,
			kindHint: kind === 'movie' || kind === 'tv' ? kind : null
		});
		return { saved: true };
	},

	rematch: async ({ request, locals, params }) => {
		const { listIds } = listContext(locals);
		const item = requireItem(Number(params.id), listIds);
		const f = await request.formData();
		const mediaType = str(f, 'mediaType') as MediaType;
		const tmdbId = Number(str(f, 'tmdbId'));
		if (str(f, 'none') === '1') {
			setMatch(item.id, null);
			return { rematched: true };
		}
		if ((mediaType !== 'movie' && mediaType !== 'tv') || !isTmdbId(tmdbId)) {
			return fail(400, { message: 'Pick a result first.' });
		}
		try {
			await fetchDetails(mediaType, tmdbId);
		} catch {
			return fail(502, { message: 'TMDB didn’t answer. Try again in a moment.' });
		}
		setMatch(item.id, { mediaType, tmdbId });
		return { rematched: true };
	},

	remove: ({ locals, params }) => {
		const { listIds } = listContext(locals);
		const item = requireItem(Number(params.id), listIds);
		deleteItem(item.id);
		redirect(303, item.status === 'watched' ? '/watched' : '/');
	}
};
