import type { LayoutServerLoad } from './$types';
import { getPrefs } from '#lib/server/prefs.js';
import { isMode, isTheme } from '#lib/themes.js';

export const load: LayoutServerLoad = ({ locals, cookies }) => {
	const user = locals.user;
	const prefs = user ? getPrefs(user.id) : null;
	const cookieTheme = cookies.get('theme');
	const cookieMode = cookies.get('mode');
	return {
		user: user ? { id: user.id, name: user.name, email: user.email } : null,
		theme:
			locals.themeOverride ?? prefs?.theme ?? (isTheme(cookieTheme) ? cookieTheme : 'programme'),
		mode: prefs?.mode ?? (isMode(cookieMode) ? cookieMode : 'system')
	};
};
