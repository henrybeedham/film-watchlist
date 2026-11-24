import type { LayoutServerLoad } from './$types';
import { appContext } from '#lib/server/context.js';
import { TMDB_ENABLED } from '#lib/server/config.js';

export const load: LayoutServerLoad = ({ locals, url }) => {
	const { prefs, lists, listId } = appContext(locals, url);
	return {
		lists,
		currentList: lists.find((l) => l.id === listId) ?? null,
		view: prefs.view,
		services: prefs.services,
		tmdbEnabled: TMDB_ENABLED
	};
};
