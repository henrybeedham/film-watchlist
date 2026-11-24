import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '#lib/server/auth.js';
import { run } from '#lib/server/db.js';
import { createList, findInvite, useInvite, userCount } from '#lib/server/lists.js';
import { setPrefs } from '#lib/server/prefs.js';
import { text } from '#lib/server/form.js';
import { hit } from '#lib/server/rate-limit.js';
import { checkSetupCode, clearSetupCode } from '#lib/server/setup.js';

export const load: PageServerLoad = ({ locals, url }) => {
	const token = url.searchParams.get('invite') ?? '';
	const invite = token ? findInvite(token) : undefined;
	if (locals.user) redirect(303, invite ? `/invite/${encodeURIComponent(token)}` : '/');
	return {
		first: userCount() === 0,
		invite: invite ? { token, listName: invite.listName, invitedBy: invite.invitedBy } : null,
		badInvite: !!token && !invite
	};
};

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const form = await request.formData();
		const name = text(form, 'name').trim().slice(0, 80);
		const email = text(form, 'email').trim().slice(0, 254);
		const password = text(form, 'password');
		const token = text(form, 'invite');
		const values = { name, email };

		if (!hit(`signup:ip:${getClientAddress()}`, 10, 60 * 60)) {
			return fail(429, { ...values, message: 'Too many attempts. Try again in an hour.' });
		}

		const first = userCount() === 0;
		const invite = token ? findInvite(token) : undefined;
		if (first) {
			if (!checkSetupCode(text(form, 'setup'))) {
				return fail(400, {
					...values,
					message: 'That setup code isn’t right. It’s printed in the server log.'
				});
			}
		} else if (!invite) {
			return fail(400, {
				...values,
				message: 'That invite link has expired or been used. Ask for a new one.'
			});
		}
		if (!name) return fail(400, { ...values, message: 'Enter your name.' });
		if (password.length < 8 || password.length > 128) {
			return fail(400, { ...values, message: 'Use a password of 8 to 128 characters.' });
		}

		let userId: string;
		try {
			const res = await auth.api.signUpEmail({
				body: { name, email, password },
				headers: request.headers
			});
			userId = res.user.id;
		} catch (e) {
			if (e instanceof APIError) {
				const message = /exist/i.test(e.message)
					? 'There’s already an account with that email. Sign in instead.'
					: e.message || 'Couldn’t create the account.';
				return fail(400, { ...values, message });
			}
			throw e;
		}

		if (invite) {
			const used = useInvite(token, userId);
			if (!used) {
				// Someone else used the invite while this account was being created: one invite,
				// one account. Remove the account again (its session and login go with it).
				run('DELETE FROM "user" WHERE id = ?', userId);
				return fail(400, {
					...values,
					message: 'That invite link has expired or been used. Ask for a new one.'
				});
			}
			// A site invite comes without a list, so they start with one of their own.
			const listId = used.listId ?? createList(userId, 'Films to watch');
			setPrefs(userId, { currentListId: listId });
		} else {
			clearSetupCode();
			const listId = createList(userId, 'Films to watch');
			setPrefs(userId, { currentListId: listId });
		}
		redirect(303, first ? '/import' : '/');
	}
};
