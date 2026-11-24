// Caches the app's own built files so it opens fast from the home screen.
// Pages and data always come from the network: lists are shared and change often.
import { self as sw } from '$app/service-worker';
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

const CACHE = `watchlist-${version}`;
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
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== sw.location.origin) return;
	if (!ASSETS.includes(url.pathname)) return;
	event.respondWith(caches.match(url.pathname).then((hit) => hit ?? fetch(event.request)));
});
