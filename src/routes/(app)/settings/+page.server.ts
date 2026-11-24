import { fail } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { appContext } from '#lib/server/context.js';
import { setPrefs } from '#lib/server/prefs.js';
import { regionProviderCatalogue } from '#lib/server/tmdb.js';
import { auth } from '#lib/server/auth.js';
import { isMode, isTheme } from '#lib/themes.js';
import { text } from '#lib/server/form.js';
import { hit } from '#lib/server/rate-limit.js';

export const load: PageServerLoad = async ({ locals, url }) => {
	const { prefs } = appContext(locals, url);
	return { catalogue: await regionProviderCatalogue(), mode: prefs.mode, theme: prefs.theme };
};

const YEAR = 60 * 60 * 24 * 365;

export const actions: Actions = {
	appearance: async ({ request, locals, cookies }) => {
		const { user } = appContext(locals);
		const f = await request.formData();
		const theme = f.get('theme');
		const mode = f.get('mode');
		if (isTheme(theme)) {
			// A new theme brings its own default view.
			setPrefs(user.id, { theme, view: null });
			cookies.set('theme', theme, { path: '/', maxAge: YEAR, httpOnly: false, sameSite: 'lax' });
		}
		if (isMode(mode)) {
			setPrefs(user.id, { mode });
			cookies.set('mode', mode, { path: '/', maxAge: YEAR, httpOnly: false, sameSite: 'lax' });
		}
		return { ok: true };
	},

	services: async ({ request, locals }) => {
		const { user } = appContext(locals);
		const f = await request.formData();
		const names = f
			.getAll('service')
			.filter((v): v is string => typeof v === 'string')
			.map((v) => v.trim().slice(0, 80))
			.filter(Boolean)
			.slice(0, 60);
		setPrefs(user.id, { services: names });
		return { servicesSaved: true };
	},

	name: async ({ request, locals }) => {
		appContext(locals);
		const f = await request.formData();
		const name = text(f, 'name').trim().slice(0, 80);
		if (!name) return fail(400, { nameMessage: 'Enter a name.' });
		await auth.api.updateUser({ body: { name }, headers: request.headers });
		return { nameSaved: true };
	},

	password: async ({ request, locals }) => {
		const { user } = appContext(locals);
		const f = await request.formData();
		const currentPassword = text(f, 'current');
		const newPassword = text(f, 'new');
		// Checking the current password is a way to guess it, so limit tries per account.
		if (!hit(`password:${user.id}`, 10, 15 * 60)) {
			return fail(429, { passwordMessage: 'Too many attempts. Wait a few minutes.' });
		}
		if (newPassword.length < 8 || newPassword.length > 128) {
			return fail(400, { passwordMessage: 'Use a new password of 8 to 128 characters.' });
		}
		try {
			await auth.api.changePassword({
				body: { currentPassword, newPassword, revokeOtherSessions: true },
				headers: request.headers
			});
		} catch (e) {
			if (e instanceof APIError) {
				return fail(400, { passwordMessage: 'Your current password isn’t right.' });
			}
			throw e;
		}
		return { passwordSaved: true };
	}
};
