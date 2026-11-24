import type { Actions, PageServerLoad } from './$types';
import { appContext } from '#lib/server/context.js';
import { listItems } from '#lib/server/items.js';
import { itemActions } from '#lib/server/item-actions.js';

export const load: PageServerLoad = ({ locals, url }) => {
	const { listId, user } = appContext(locals, url);
	if (listId === null) return { items: [], diaryCount: 0, ratedCount: 0, me: user.id };
	const items = listItems(listId, 'watched');
	const mine = items.flatMap((i) => i.diary.filter((e) => e.userId === user.id));
	return {
		items,
		me: user.id,
		diaryCount: mine.length,
		ratedCount: mine.filter((e) => e.rating).length,
		thisYear: mine.filter((e) => e.watchedOn?.startsWith(String(new Date().getFullYear()))).length
	};
};

export const actions: Actions = itemActions;
