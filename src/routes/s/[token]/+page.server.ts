import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listByShareToken } from '#lib/server/lists.js';
import { listItems } from '#lib/server/items.js';
import { getPrefs } from '#lib/server/prefs.js';
import { TMDB_ENABLED } from '#lib/server/config.js';
import { defaultView } from '#lib/themes.js';

export const load: PageServerLoad = ({ params, locals, setHeaders }) => {
	const list = listByShareToken(params.token);
	if (!list) error(404, 'This share link has been turned off or doesn’t exist.');
	setHeaders({ 'x-robots-tag': 'noindex', 'cache-control': 'private, max-age=60' });

	// Shown in the owner's theme.
	const theme = getPrefs(list.owner_id).theme;
	locals.themeOverride = theme;

	// Strip anything personal beyond first names.
	const strip = (status: 'want' | 'watched') =>
		listItems(list.id, status).map((i) => ({
			...i,
			addedBy: null,
			addedByName: null,
			diary: i.diary.map((e) => ({
				...e,
				userId: '',
				userName: e.userName.split(' ')[0],
				review: null
			}))
		}));
	const want = strip('want');
	return {
		listName: list.name,
		ownerName: list.owner_name.split(' ')[0],
		want: want.filter((i) => !i.comingSoon),
		soon: want.filter((i) => i.comingSoon),
		watched: strip('watched'),
		view: defaultView(theme),
		tmdbEnabled: TMDB_ENABLED
	};
};
