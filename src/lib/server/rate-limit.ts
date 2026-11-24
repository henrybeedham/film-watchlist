// In-memory, fixed-window rate limits for sign-in, sign-up and other abusable actions.
// better-auth's own limiter only covers its HTTP endpoints, and the app calls auth.api.* from
// form actions instead, so the limits live here. One process, so memory is enough.

interface Bucket {
	count: number;
	resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Counts one attempt against `key`. Returns false once more than `max` attempts have been
 * made within `windowSeconds`.
 */
export function hit(key: string, max: number, windowSeconds: number): boolean {
	const t = Date.now();
	let b = buckets.get(key);
	if (!b || b.resetAt <= t) {
		b = { count: 0, resetAt: t + windowSeconds * 1000 };
		buckets.set(key, b);
	}
	b.count++;
	return b.count <= max;
}

/** Forgets the attempts against `key`, e.g. after a successful sign-in. */
export function reset(key: string) {
	buckets.delete(key);
}

// Drop expired buckets so the map can't grow without bound.
const sweep = setInterval(() => {
	const t = Date.now();
	for (const [k, b] of buckets) if (b.resetAt <= t) buckets.delete(k);
}, 60_000);
sweep.unref();
process.on('sveltekit:shutdown', () => clearInterval(sweep));
