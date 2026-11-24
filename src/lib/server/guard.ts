import { error, redirect } from '@sveltejs/kit';
import type { SessionUser } from './auth';

/** For pages and form actions: send signed-out visitors to the sign-in page. */
export function requireUser(locals: App.Locals, returnTo?: URL): SessionUser {
	if (!locals.user) {
		const next = returnTo ? `?next=${encodeURIComponent(returnTo.pathname + returnTo.search)}` : '';
		redirect(303, `/signin${next}`);
	}
	return locals.user;
}

/** For +server.ts endpoints: answer 401 rather than redirecting. */
export function requireApiUser(locals: App.Locals): SessionUser {
	if (!locals.user) error(401, 'Sign in first.');
	return locals.user;
}
