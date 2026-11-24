// Asks the service worker to fetch images into its cache in the background.

/** Sends `urls` to the service worker once the browser is idle. Returns a cancel function. */
export function warmImages(urls: string[]): () => void {
	if (urls.length === 0 || !('serviceWorker' in navigator)) return () => {};
	const send = () => navigator.serviceWorker.controller?.postMessage({ type: 'warm', urls });
	if ('requestIdleCallback' in window) {
		const id = requestIdleCallback(send, { timeout: 3000 });
		return () => cancelIdleCallback(id);
	}
	const id = setTimeout(send, 1500);
	return () => clearTimeout(id);
}
