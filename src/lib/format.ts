// Formatting helpers shared by server and browser. British conventions throughout.

const TZ = 'Europe/London';

/** Today's date in the UK as YYYY-MM-DD. */
export function todayIso(): string {
	return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/** "23 November 2026" */
export function longDate(iso: string | null | undefined): string {
	if (!iso) return '';
	const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
	if (Number.isNaN(d.getTime())) return '';
	return d.toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: TZ
	});
}

/** "23 Nov" this year, "23 Nov 2025" otherwise. */
export function shortDate(iso: string | null | undefined): string {
	if (!iso) return '';
	const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
	if (Number.isNaN(d.getTime())) return '';
	const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear();
	return d.toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: sameYear ? undefined : 'numeric',
		timeZone: TZ
	});
}

export function year(iso: string | null | undefined): number | null {
	return iso ? Number(iso.slice(0, 4)) || null : null;
}

/** "1 h 52 min", "48 min" */
export function runtime(minutes: number | null | undefined): string {
	if (!minutes) return '';
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (!h) return `${m} min`;
	return m ? `${h} h ${m} min` : `${h} h`;
}

/** Ratings are stored as 1–10 (half stars). "3½" */
export function stars(rating: number | null | undefined): string {
	if (!rating) return '';
	const whole = Math.floor(rating / 2);
	return `${whole || ''}${rating % 2 ? '½' : ''}`;
}

/** TMDB image paths look like "/abc123.jpg"; anything else is ignored rather than put in a URL. */
const IMAGE_PATH = /^\/[\w-]+\.(jpe?g|png|svg|webp)$/i;

export function poster(
	path: string | null | undefined,
	size: 'w92' | 'w185' | 'w342' | 'w500' = 'w342'
) {
	return path && IMAGE_PATH.test(path) ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export function logo(path: string | null | undefined) {
	return path && IMAGE_PATH.test(path) ? `https://image.tmdb.org/t/p/w92${path}` : null;
}

export function kindLabel(type: 'movie' | 'tv' | null | undefined): string {
	return type === 'movie' ? 'Film' : type === 'tv' ? 'Series' : '';
}

/** "Hugh" → "H", "Henry Beedham" → "HB" */
export function initials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0].toUpperCase())
		.join('');
}

export function plural(n: number, one: string, many = `${one}s`) {
	return `${n} ${n === 1 ? one : many}`;
}
