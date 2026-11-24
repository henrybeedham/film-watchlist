import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { findInvite, roleIn, useInvite } from '#lib/server/lists.js';
import { setPrefs } from '#lib/server/prefs.js';

export const load: PageServerLoad = ({ params, locals }) => {
	const invite = findInvite(params.token);
	const already = invite && locals.user ? !!roleIn(invite.listId, locals.user.id) : false;
	return {
		token: params.token,
		invite: invite ? { listName: invite.listName, invitedBy: invite.invitedBy } : null,
		already
	};
};

export const actions: Actions = {
	default: ({ params, locals }) => {
		if (!locals.user) {
			redirect(303, `/signin?next=${encodeURIComponent(`/invite/${params.token}`)}`);
		}
		const listId = useInvite(params.token, locals.user.id);
		if (!listId) return fail(400, { message: 'That invite has expired or been used.' });
		setPrefs(locals.user.id, { currentListId: listId });
		redirect(303, '/');
	}
};
