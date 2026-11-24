import type { Handle } from '@sveltejs/kit/hooks';
import { building } from '$app/env';
import { auth } from '#lib/server/auth.js';
import { pageAppearance } from '#lib/server/prefs.js';
import { startEnrichment } from '#lib/server/enrich.js';
import { announceSetupCode } from '#lib/server/setup.js';
import { PUBLIC_URL } from '#lib/server/config.js';

if (!building) {
	startEnrichment();
	announceSetupCode();
}

const HTTPS = PUBLIC_URL.startsWith('https:');

// The Content-Security-Policy is set by SvelteKit (see `csp` in vite.config.ts) so it can add nonces.
const SECURITY_HEADERS: Record<string, string> = {
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'DENY',
	// Invite and share links carry their token in the path; never send it to other sites.
	'referrer-policy': 'same-origin',
	'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
	'cross-origin-opener-policy': 'same-origin',
	'cross-origin-resource-policy': 'same-origin',
	// A private app: keep every page, including share links, out of search engines.
	'x-robots-tag': 'noindex, nofollow',
	...(HTTPS ? { 'strict-transport-security': 'max-age=63072000; includeSubDomains' } : {})
};

export const handle: Handle = async ({ event, resolve }) => {
	// Every sign-in, sign-up and account change goes through the app's own form actions, which
	// call auth.api on the server with their own checks and rate limits. better-auth's HTTP
	// endpoints aren't used by the browser, so they aren't exposed at all.
	if (event.url.pathname === '/api/auth' || event.url.pathname.startsWith('/api/auth/')) {
		return new Response('Not found', { status: 404 });
	}

	if (!event.url.pathname.startsWith('/healthz')) {
		const session = await auth.api.getSession({ headers: event.request.headers });
		event.locals.user = session?.user ?? null;
		event.locals.session = session?.session ?? null;
	} else {
		event.locals.user = null;
		event.locals.session = null;
	}

	const response = await resolve(event, {
		// Theme and light/dark are rendered on the server so there's no flash.
		// A page's load can set locals.themeOverride (the public share page does).
		transformPageChunk: ({ html }) => {
			const { theme, mode } = pageAppearance(event.locals, event.cookies);
			return html
				.replace('%app.theme%', theme)
				.replace('%app.mode%', mode)
				.replace('%app.class%', mode === 'dark' ? 'dark' : '');
		}
	});

	try {
		for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
			if (!response.headers.has(name)) response.headers.set(name, value);
		}
		// Signed-in pages and data hold private lists: don't let the browser or a proxy keep them.
		if (event.locals.user && !response.headers.has('cache-control')) {
			response.headers.set('cache-control', 'private, no-store');
		}
	} catch {
		// Some responses (e.g. from fetch) have immutable headers; leave them as they are.
	}
	return compress(event.request, response);
};

// Pages and their data are mostly repeated JSON keys and markup, and shrink 5–10× with gzip.
// The Node adapter doesn't compress what the app renders (only its prebuilt files), so do it here.
const COMPRESSIBLE = /^(text\/html|application\/json|text\/plain|image\/svg\+xml)\b/;

function compress(request: Request, response: Response) {
	const type = response.headers.get('content-type') ?? '';
	const length = Number(response.headers.get('content-length') ?? Infinity);
	if (
		!response.body ||
		request.method === 'HEAD' ||
		response.status === 204 ||
		response.status === 304 ||
		response.headers.has('content-encoding') ||
		!COMPRESSIBLE.test(type) ||
		length < 1024 ||
		!/\bgzip\b/.test(request.headers.get('accept-encoding') ?? '')
	) {
		return response;
	}
	const headers = new Headers(response.headers);
	headers.set('content-encoding', 'gzip');
	headers.delete('content-length');
	headers.append('vary', 'accept-encoding');
	return new Response(response.body.pipeThrough(new CompressionStream('gzip')), {
		status: response.status,
		statusText: response.statusText,
		headers
	});
}
