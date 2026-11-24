import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { findInvite, roleIn, useInvite } from '#lib/server/lists.js';
import { setPrefs } from '#lib/server/prefs.js';

export const load: PageServerLoad = ({ params, locals }) => {
	const invite = findInvite(params.token);
	const already =
		invite && locals.user
			? invite.listId === null || !!roleIn(invite.listId, locals.user.id)
			: false;
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
		// A site invite has nothing to join for someone who already has an account; leave it unused.
		if (findInvite(params.token)?.listId === null) redirect(303, '/');
		const used = useInvite(params.token, locals.user.id);
		if (!used) return fail(400, { message: 'That invite has expired or been used.' });
		if (used.listId !== null) setPrefs(locals.user.id, { currentListId: used.listId });
		redirect(303, '/');
	}
};
