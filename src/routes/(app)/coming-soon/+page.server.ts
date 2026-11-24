import type { Actions, PageServerLoad } from './$types';
import { appContext } from '#lib/server/context.js';
import { listItems } from '#lib/server/items.js';
import { itemActions } from '#lib/server/item-actions.js';

export const load: PageServerLoad = ({ locals, url }) => {
	const { listId } = appContext(locals, url);
	if (listId === null) return { items: [] };
	return { items: listItems(listId, 'want').filter((i) => i.comingSoon) };
};

export const actions: Actions = itemActions;
