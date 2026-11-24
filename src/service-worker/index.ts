// Caches the app's own built files so it opens fast from the home screen, and TMDB posters and
// logos so they show instantly (and offline) once seen. Pages and data always come from the
// network: lists are shared and change often.
import { self as sw } from '$app/service-worker';
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

const CACHE = `watchlist-${version}`;
// Kept across deploys: an image at a given TMDB path never changes.
const IMAGES = 'tmdb-images-v1';
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
	);
});

sw.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET') return;
	if (url.origin === IMAGE_ORIGIN && url.pathname.startsWith('/t/p/')) {
		event.respondWith(cachedImage(url.href));
		return;
	}
	if (url.origin !== sw.location.origin) return;
	if (!ASSETS.includes(url.pathname)) return;
	event.respondWith(caches.match(url.pathname).then((hit) => hit ?? fetch(event.request)));
});

/** Cache-first. TMDB sends CORS headers, so the stored copy isn't an opaque response. */
async function cachedImage(href: string) {
	const cache = await caches.open(IMAGES);
	const hit = await cache.match(href);
	if (hit) return hit;
	const res = await fetch(href, { mode: 'cors', credentials: 'omit' });
	if (res.ok) {
		await cache.put(href, res.clone());
		void trimImages(cache);
	}
	return res;
}

let trimming = false;
async function trimImages(cache: Cache) {
	if (trimming) return;
	trimming = true;
	try {
		const keys = await cache.keys(); // oldest first
		for (const req of keys.slice(0, Math.max(0, keys.length - MAX_IMAGES))) await cache.delete(req);
	} finally {
		trimming = false;
	}
}
