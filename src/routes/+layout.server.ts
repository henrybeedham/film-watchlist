import type { LayoutServerLoad } from './$types';
import { pageAppearance } from '#lib/server/prefs.js';

export const load: LayoutServerLoad = ({ locals, cookies }) => {
	const user = locals.user;
	return {
		user: user ? { id: user.id, name: user.name, email: user.email } : null,
		...pageAppearance(locals, cookies)
	};
};
