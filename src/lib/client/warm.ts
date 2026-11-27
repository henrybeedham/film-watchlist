// Loads images into the browser's HTTP cache in the background. Plain image loads, not fetch():
// TMDB's CDN leaves the CORS headers off some images, and a CORS request for one of those fails
// (and on iOS home-screen apps can break the poster showing it).

const AT_ONCE = 4;

/** Loads `urls` a few at a time once the browser is idle. Returns a cancel function. */
export function warmImages(urls: string[]): () => void {
	if (urls.length === 0) return () => {};
	let cancelled = false;
	const queue = [...urls];
	const next = () => {
		const src = queue.shift();
		if (!src || cancelled) return;
		const img = new Image();
		img.decoding = 'async';
		img.onload = img.onerror = next;
		img.src = src;
	};
	const start = () => {
		for (let i = 0; i < AT_ONCE; i++) next();
	};
	if ('requestIdleCallback' in window) {
		const id = requestIdleCallback(start, { timeout: 3000 });
		return () => {
			cancelled = true;
			cancelIdleCallback(id);
		};
	}
	const id = setTimeout(start, 1500);
	return () => {
		cancelled = true;
		clearTimeout(id);
	};
}
