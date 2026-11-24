import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { appContext } from '#lib/server/context.js';
import {
	deleteUser,
	makeAdmin,
	removeAdmin,
	requireAdmin,
	setSiteTheme,
	setUserPassword,
	signOutEverywhere,
	siteTheme,
	siteUsers,
	userExists
} from '#lib/server/site.js';
import { isTheme } from '#lib/themes.js';
import { text } from '#lib/server/form.js';

export const load: PageServerLoad = ({ locals, url }) => {
	const { user } = appContext(locals, url);
	requireAdmin(user.id);
	return { siteTheme: siteTheme(), users: siteUsers(), me: user.id };
};

/** Every action: the caller must be an admin, and most act on another account by id. */
async function adminForm(locals: App.Locals, request: Request) {
	const { user } = appContext(locals);
	requireAdmin(user.id);
	const f = await request.formData();
	return { me: user.id, f, target: text(f, 'userId') };
}

export const actions: Actions = {
	siteTheme: async ({ request, locals }) => {
		const { f } = await adminForm(locals, request);
		const theme = f.get('siteTheme');
		if (!isTheme(theme)) return fail(400, { message: 'Pick a theme.' });
		setSiteTheme(theme);
		return { done: 'Site theme saved.' };
	},

	makeAdmin: async ({ request, locals }) => {
		const { target } = await adminForm(locals, request);
		if (!userExists(target)) return fail(404, { message: 'That account no longer exists.' });
		makeAdmin(target);
		return { done: 'They’re now an admin.' };
	},

	removeAdmin: async ({ request, locals }) => {
		const { target, me } = await adminForm(locals, request);
		if (!removeAdmin(target)) {
			return fail(400, {
				message: 'The site needs at least one admin. Make someone else one first.'
			});
		}
		return { done: target === me ? 'You’re no longer an admin.' : 'They’re no longer an admin.' };
	},

	password: async ({ request, locals }) => {
		const { target, f } = await adminForm(locals, request);
		const password = text(f, 'password');
		if (password.length < 8 || password.length > 128) {
			return fail(400, { message: 'Use a password of 8 to 128 characters.' });
		}
		if (!(await setUserPassword(target, password))) {
			return fail(404, { message: 'That account has no password to change.' });
		}
		return { done: 'Password set. They’ve been signed out everywhere.' };
	},

	signOut: async ({ request, locals }) => {
		const { target, me } = await adminForm(locals, request);
		if (target === me) return fail(400, { message: 'Use Sign out at the bottom of the page.' });
		signOutEverywhere(target);
		return { done: 'Signed out on every device.' };
	},

	delete: async ({ request, locals }) => {
		const { target, me } = await adminForm(locals, request);
		if (target === me) return fail(400, { message: 'You can’t delete your own account here.' });
		if (!userExists(target)) return fail(404, { message: 'That account no longer exists.' });
		deleteUser(target);
		return { done: 'Account deleted.' };
	}
};
