import { betterAuth } from 'better-auth';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from './db';
import { AUTH_SECRET, IS_PRODUCTION, PUBLIC_URL } from './config';

export const auth = betterAuth({
	appName: 'Watchlist',
	database: db,
	secret: AUTH_SECRET,
	baseURL: PUBLIC_URL,
	trustedOrigins: [PUBLIC_URL],
	emailAndPassword: {
		enabled: true,
		minPasswordLength: 8,
		maxPasswordLength: 128,
		autoSignIn: true
	},
	session: {
		expiresIn: 60 * 60 * 24 * 60, // 60 days
		updateAge: 60 * 60 * 24
	},
	advanced: {
		// Secure cookies whenever the site is served over https, whatever NODE_ENV says.
		useSecureCookies: IS_PRODUCTION || PUBLIC_URL.startsWith('https:'),
		defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' }
	},
	// Rate limits for sign-in and sign-up live in the app's form actions (rate-limit.ts):
	// better-auth's limiter only sees its HTTP endpoints, which hooks.server.ts doesn't expose.
	hooks: {
		// Defence in depth: sign-up is invite-only, so the endpoint never answers HTTP requests.
		// The app's own form action checks the invite and calls auth.api.signUpEmail on the server.
		before: createAuthMiddleware((ctx) => {
			if (ctx.path === '/sign-up/email' && ctx.request) {
				throw new APIError('FORBIDDEN', { message: 'Sign up with an invite link.' });
			}
			return Promise.resolve();
		})
	},
	plugins: [sveltekitCookies(getRequestEvent)] // must stay last
});

export type SessionUser = typeof auth.$Infer.Session.user;
