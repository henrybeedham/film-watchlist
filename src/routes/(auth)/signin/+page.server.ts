import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '#lib/server/auth.js';
import { userCount } from '#lib/server/lists.js';
import { text } from '#lib/server/form.js';
import { hit, reset } from '#lib/server/rate-limit.js';

/** Only ever redirect to a path on this site ("/\evil.com" and "//evil.com" are other sites). */
function safeNext(next: string | null, origin: string) {
	if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
	try {
		const url = new URL(next, origin);
		return url.origin === origin ? url.pathname + url.search + url.hash : '/';
	} catch {
		return '/';
	}
}

const TOO_MANY = 'Too many attempts. Wait a few minutes and try again.';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeNext(url.searchParams.get('next'), url.origin));
	if (userCount() === 0) redirect(303, '/signup');
	return { next: url.searchParams.get('next') };
};

export const actions: Actions = {
	default: async ({ request, url, getClientAddress }) => {
		const form = await request.formData();
		const email = text(form, 'email').trim().slice(0, 254);
		const password = text(form, 'password');
		if (!email || !password) return fail(400, { email, message: 'Enter your email and password.' });

		// Per address (stops one machine guessing) and per account (stops many machines guessing).
		const emailKey = `signin:email:${email.toLowerCase()}`;
		const ipOk = hit(`signin:ip:${getClientAddress()}`, 30, 15 * 60);
		const emailOk = hit(emailKey, 10, 15 * 60);
		if (!ipOk || !emailOk) return fail(429, { email, message: TOO_MANY });

		try {
			await auth.api.signInEmail({ body: { email, password }, headers: request.headers });
		} catch (e) {
			if (e instanceof APIError) {
				const message =
					e.status === 'TOO_MANY_REQUESTS'
						? TOO_MANY
						: 'That email and password don’t match an account.';
				return fail(400, { email, message });
			}
			throw e;
		}
		reset(emailKey);
		redirect(303, safeNext(url.searchParams.get('next'), url.origin));
	}
};
