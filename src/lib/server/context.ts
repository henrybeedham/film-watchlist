// What every signed-in page needs: who's here, their settings and the list they're on.
import { error } from '@sveltejs/kit';
import { requireUser } from './guard';
import { currentListId, getPrefs } from './prefs';
import { userLists } from './lists';

export function appContext(locals: App.Locals, url?: URL) {
	const user = requireUser(locals, url);
	const prefs = getPrefs(user.id);
	const lists = userLists(user.id);
	const listId = currentListId(user.id, prefs);
	return { user, prefs, lists, listId, listIds: lists.map((l) => l.id) };
}

/** Same, but for actions that need a current list to act on. */
export function listContext(locals: App.Locals) {
	const ctx = appContext(locals);
	if (ctx.listId === null) error(400, 'Create a list first.');
	return { ...ctx, listId: ctx.listId };
}
