import type { Actions, PageServerLoad } from './$types';
import { appContext } from '#lib/server/context.js';
import { listItems, pendingCount } from '#lib/server/items.js';
import { itemActions } from '#lib/server/item-actions.js';

export const load: PageServerLoad = ({ locals, url, depends }) => {
	depends('app:items');
	const { listId } = appContext(locals, url);
	if (listId === null) return { items: [], soonCount: 0, pending: 0 };
	const all = listItems(listId, 'want');
	return {
		items: all.filter((i) => !i.comingSoon),
		soonCount: all.filter((i) => i.comingSoon).length,
		pending: pendingCount(listId)
	};
};

export const actions: Actions = itemActions;
