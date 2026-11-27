// Caches the app's own built files so it opens fast from the home screen, and TMDB posters and
// logos so they show instantly (and offline) once seen. Pages and data always come from the
// network: lists are shared and change often.
import { self as sw } from '$app/service-worker';
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

const CACHE = `watchlist-${version}`;
// Kept across deploys: an image at a given TMDB path never changes.
const IMAGES = 'tmdb-images-v2';
const IMAGE_ORIGIN = 'https://image.tmdb.org';
// Roughly 30–60 MB at poster sizes; the oldest are dropped first.
const MAX_IMAGES = 1000;
const ASSETS = [...immutable, ...assets]
	.map((f) => f.path)
	.filter((p) => !p.includes('robots'))
	.map((p) => (p.startsWith('/') ? p : `/${p}`));

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((k) => k !== CACHE && k !== IMAGES).map((k) => caches.delete(k)))
			)
			.then(() => sw.clients.claim())
			.then(() => caches.open(IMAGES))
			.then(trimImages)
	);
});

// Image hrefs stored in IMAGES, read from the cache when the worker starts.
const cached = new Set<string>();
// TMDB's CDN leaves the CORS headers off some images. Those can't be stored readably, so the
// browser keeps loading them itself (its own HTTP cache still holds them for a year).
const uncacheable = new Set<string>();
const ready = caches
	.open(IMAGES)
	.then((cache) => cache.keys())
	.then((keys) => keys.forEach((req) => cached.add(req.url)))
	.catch(() => {});

sw.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET') return;
	if (url.origin === IMAGE_ORIGIN && url.pathname.startsWith('/t/p/')) {
		if (cached.has(url.href)) {
			event.respondWith(
				fromCache(url.href)
					.then((hit) => hit ?? fetch(event.request))
					.catch(() => fetch(event.request))
			);
		} else {
			// Not stored yet: leave the request to the browser, exactly as in a normal tab, and store a
			// copy in the background for next time.
			event.waitUntil(warm([url.href], false));
		}
		return;
	}
	if (url.origin !== sw.location.origin) return;
	if (!ASSETS.includes(url.pathname)) return;
	event.respondWith(caches.match(url.pathname).then((hit) => hit ?? fetch(event.request)));
});

/**
 * The stored copy, read in full first: WebKit (notably home-screen apps on iOS) can keep a cache
 * entry whose body it has evicted, which would otherwise show as a blank image.
 */
async function fromCache(href: string): Promise<Response | null> {
	const cache = await caches.open(IMAGES);
	const hit = await cache.match(href);
	if (hit) {
		try {
			const body = await hit.blob();
			if (body.size > 0) return new Response(body, { status: hit.status, headers: hit.headers });
		} catch {
			// Unreadable: drop it below.
		}
		await cache.delete(href).catch(() => {});
	}
	cached.delete(href);
	return null;
}

/** Fetches `href` with CORS and stores it, so the copy isn't an opaque response. */
async function store(cache: Cache, href: string) {
	if (cached.has(href) || uncacheable.has(href)) return;
	let res: Response;
	try {
		res = await fetch(href, { mode: 'cors', credentials: 'omit' });
	} catch {
		// No CORS headers on this one (or offline): don't keep trying it this session.
		uncacheable.add(href);
		return;
	}
	if (!res.ok) return;
	await cache.put(href, res);
	cached.add(href);
	if (++added % 50 === 0) void trimImages(cache);
}

let added = 0;
let trimming = false;
async function trimImages(cache: Cache) {
	if (trimming) return;
	trimming = true;
	try {
		const keys = await cache.keys(); // oldest first
		for (const req of keys.slice(0, Math.max(0, keys.length - MAX_IMAGES))) {
			await cache.delete(req);
			cached.delete(req.url);
		}
	} finally {
		trimming = false;
	}
}

// The page sends the images on the list it's showing; fetch the ones not cached yet, a few at a
// time so they never compete with what's on screen.
let warmQueue: string[] = [];
let warming: Promise<void> | null = null;

sw.addEventListener('message', (event) => {
	const data = event.data as { type?: string; urls?: unknown } | null;
	if (data?.type !== 'warm' || !Array.isArray(data.urls)) return;
	const urls = data.urls.filter(
		(u): u is string => typeof u === 'string' && u.startsWith(`${IMAGE_ORIGIN}/t/p/`)
	);
	event.waitUntil(warm(urls, true));
});

function warm(urls: string[], first: boolean) {
	const queue = first ? [...urls, ...warmQueue] : [...warmQueue, ...urls];
	warmQueue = [...new Set(queue)].slice(0, MAX_IMAGES);
	warming ??= drainWarm().finally(() => (warming = null));
	return warming;
}

async function drainWarm() {
	await ready;
	const cache = await caches.open(IMAGES);
	const worker = async () => {
		for (let href = warmQueue.shift(); href; href = warmQueue.shift()) {
			try {
				await store(cache, href);
			} catch {
				// Storage full or a TMDB hiccup: it'll be tried again when next shown.
			}
		}
	};
	await Promise.all([worker(), worker(), worker(), worker()]);
}
