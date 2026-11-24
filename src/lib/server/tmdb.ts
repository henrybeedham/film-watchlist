// TMDB API client: search, details, UK streaming availability. Results are cached in `titles`.
import { REGION, TMDB_ENABLED, TMDB_KEY } from './config';
import { get, getSetting, now, run, setSetting } from './db';
import { titleKey } from '#lib/notes-parser.js';
import type { MediaType, Provider, Providers, Title, TmdbSearchResult } from '#lib/types.js';

const API = 'https://api.themoviedb.org/3';
const DETAILS_MAX_AGE = 1000 * 60 * 60 * 24 * 14; // two weeks
const PROVIDERS_MAX_AGE = 1000 * 60 * 60 * 24 * 3; // three days

export { TMDB_ENABLED };

async function tmdb<T>(path: string, params: Record<string, string | number | undefined> = {}) {
	if (!TMDB_ENABLED) throw new Error('TMDB is not configured.');
	const url = new URL(API + path);
	for (const [k, v] of Object.entries(params))
		if (v !== undefined) url.searchParams.set(k, String(v));
	const headers: Record<string, string> = { accept: 'application/json' };
	if (TMDB_KEY.startsWith('eyJ')) headers.authorization = `Bearer ${TMDB_KEY}`;
	else url.searchParams.set('api_key', TMDB_KEY);

	for (let attempt = 0; attempt < 3; attempt++) {
		const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
		if (res.status === 429) {
			const wait = Number(res.headers.get('retry-after') ?? 1) * 1000;
			await new Promise((r) => setTimeout(r, Math.min(wait, 5000)));
			continue;
		}
		if (!res.ok) throw new Error(`TMDB ${res.status} for ${path}`);
		return (await res.json()) as T;
	}
	throw new Error(`TMDB kept rate-limiting ${path}`);
}

// ---- Search ----------------------------------------------------------------

interface RawResult {
	id: number;
	media_type?: string;
	title?: string;
	name?: string;
	original_title?: string;
	original_name?: string;
	release_date?: string;
	first_air_date?: string;
	poster_path?: string | null;
	overview?: string;
	popularity?: number;
	vote_count?: number;
}

function toResult(r: RawResult, type: MediaType): TmdbSearchResult {
	const date = type === 'movie' ? r.release_date : r.first_air_date;
	return {
		mediaType: type,
		tmdbId: r.id,
		title: (type === 'movie' ? r.title : r.name) ?? '',
		year: date ? Number(date.slice(0, 4)) || null : null,
		posterPath: r.poster_path ?? null,
		overview: r.overview || null
	};
}

export async function search(query: string, kind?: MediaType | null, year?: number | null) {
	const q = query.trim();
	if (!q) return [];
	if (kind === 'movie' || kind === 'tv') {
		const path = kind === 'movie' ? '/search/movie' : '/search/tv';
		const yearParam = kind === 'movie' ? 'primary_release_year' : 'first_air_date_year';
		let data = await tmdb<{ results: RawResult[] }>(path, {
			query: q,
			include_adult: 'false',
			language: 'en-GB',
			[yearParam]: year ?? undefined
		});
		if (year && data.results.length === 0) {
			data = await tmdb(path, { query: q, include_adult: 'false', language: 'en-GB' });
		}
		return data.results.map((r) => ({ raw: r, result: toResult(r, kind) }));
	}
	const data = await tmdb<{ results: RawResult[] }>('/search/multi', {
		query: q,
		include_adult: 'false',
		language: 'en-GB'
	});
	return data.results
		.filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
		.map((r) => ({ raw: r, result: toResult(r, r.media_type as MediaType) }));
}

export async function searchResults(query: string): Promise<TmdbSearchResult[]> {
	return (await search(query)).slice(0, 12).map((r) => r.result);
}

/**
 * Picks the most likely match for a title someone typed. Returns `exact` when the title
 * matches TMDB's (ignoring case, punctuation and "The"), otherwise `guess`.
 */
export async function bestMatch(title: string, kind: MediaType | null, year: number | null) {
	const key = titleKey(title);
	const candidates = (await search(title, kind, year)).slice(0, 10);
	let best = pickBest(candidates, key, kind, year);

	// No exact title match (often a typo: "Captain Philips", "Micky 17"), or only an obscure one
	// ("The Pursuit of Happiness" from 1971). TMDB search isn't forgiving, so also search on the
	// title's longer words and compare spellings.
	if (!best || best.similarity < 1 || best.votes < 100) {
		const words = title
			.split(/\s+/)
			.filter((w) => w.replace(/\W/g, '').length >= 2 && !/^(the|and|of|a|an)$/i.test(w))
			.sort((a, b) => b.length - a.length)
			.slice(0, 3);
		const seen = new Set(candidates.map((c) => `${c.result.mediaType}:${c.result.tmdbId}`));
		const extra: typeof candidates = [];
		for (const w of words) {
			for (const c of (await search(w, kind)).slice(0, 10)) {
				const id = `${c.result.mediaType}:${c.result.tmdbId}`;
				if (!seen.has(id)) {
					seen.add(id);
					extra.push(c);
				}
			}
		}
		const fallback = pickBest(extra, key, kind, year, 0.72);
		if (fallback && (!best || fallback.score > best.score)) best = fallback;
	}
	return best ? { ...best.result, exact: best.similarity === 1 } : null;
}

/** Dice coefficient over letter pairs: 1 for identical keys, ~0.8 for a one-letter typo. */
function similarity(a: string, b: string): number {
	if (a === b) return 1;
	if (a.length < 2 || b.length < 2) return 0;
	const pairs = (s: string) => {
		const m = new Map<string, number>();
		for (let i = 0; i < s.length - 1; i++)
			m.set(s.slice(i, i + 2), (m.get(s.slice(i, i + 2)) ?? 0) + 1);
		return m;
	};
	const pa = pairs(a);
	const pb = pairs(b);
	let overlap = 0;
	for (const [k, n] of pa) overlap += Math.min(n, pb.get(k) ?? 0);
	return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

function pickBest(
	candidates: { raw: RawResult; result: TmdbSearchResult }[],
	key: string,
	kind: MediaType | null,
	year: number | null,
	minSimilarity = 0.6
) {
	let best: { result: TmdbSearchResult; score: number; similarity: number; votes: number } | null =
		null;
	for (const [i, { raw, result }] of candidates.entries()) {
		const names = [result.title, raw.original_title, raw.original_name].filter(Boolean) as string[];
		const sim = Math.max(...names.map((n) => similarity(titleKey(n), key)));
		if (sim < minSimilarity) continue;
		let score = sim * 60;
		if (year && result.year) {
			score += result.year === year ? 30 : Math.abs(result.year - year) <= 1 ? 12 : -10;
		}
		// Well-known titles are far more likely to be what someone was told to watch.
		score += Math.min(32, Math.log10((raw.vote_count ?? 0) + 1) * 8);
		score += Math.min(10, Math.log10((raw.popularity ?? 0) + 1) * 4);
		score -= i * 1.5; // TMDB's own ranking counts for something
		if (kind && result.mediaType !== kind) score -= 15;
		if (!best || score > best.score) {
			best = { result, score, similarity: sim, votes: raw.vote_count ?? 0 };
		}
	}
	return best;
}

// ---- Details and providers -------------------------------------------------

interface RawProvider {
	provider_id: number;
	provider_name: string;
	logo_path: string | null;
	display_priority?: number;
}
interface RawRegionProviders {
	link?: string;
	flatrate?: RawProvider[];
	free?: RawProvider[];
	ads?: RawProvider[];
	rent?: RawProvider[];
	buy?: RawProvider[];
}

/** "Netflix Standard with Ads" is the same service as "Netflix" for our purposes. */
const baseName = (name: string) => name.replace(/\s+(standard\s+)?with\s+ads$/i, '').trim();

function toProviders(list?: RawProvider[]): Provider[] {
	const seen = new Set<string>();
	return (list ?? [])
		.sort((a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99))
		.filter((p) => {
			const key = baseName(p.provider_name).toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		})
		.map((p) => ({ id: p.provider_id, name: baseName(p.provider_name), logo: p.logo_path }));
}

/** The "all options" link is rendered as an <a href>, so only accept plain https URLs. */
function safeLink(link: unknown): string | null {
	if (typeof link !== 'string') return null;
	try {
		return new URL(link).protocol === 'https:' ? link : null;
	} catch {
		return null;
	}
}

function regionProviders(raw?: { results?: Record<string, RawRegionProviders> }): Providers {
	const r = raw?.results?.[REGION] ?? {};
	return {
		link: safeLink(r.link),
		stream: toProviders(r.flatrate),
		free: toProviders([...(r.free ?? []), ...(r.ads ?? [])]),
		rent: toProviders(r.rent),
		buy: toProviders(r.buy)
	};
}

interface RawDetails {
	id: number;
	title?: string;
	name?: string;
	original_title?: string;
	original_name?: string;
	release_date?: string;
	first_air_date?: string;
	status?: string;
	runtime?: number;
	episode_run_time?: number[];
	last_episode_to_air?: { runtime?: number } | null;
	number_of_seasons?: number;
	genres?: { id: number; name: string }[];
	overview?: string;
	poster_path?: string | null;
	backdrop_path?: string | null;
	'watch/providers'?: { results?: Record<string, RawRegionProviders> };
	release_dates?: {
		results?: { iso_3166_1: string; release_dates: { release_date: string; type: number }[] }[];
	};
}

/** The local release date: earliest cinema or digital release in the region, else TMDB's primary. */
function localReleaseDate(d: RawDetails): string | null {
	const local = d.release_dates?.results?.find((r) => r.iso_3166_1 === REGION);
	const dates = (local?.release_dates ?? [])
		.filter((r) => r.type >= 2 && r.type <= 4)
		.map((r) => r.release_date.slice(0, 10))
		.sort();
	return dates[0] ?? d.release_date ?? d.first_air_date ?? null;
}

export async function fetchDetails(type: MediaType, id: number) {
	const d = await tmdb<RawDetails>(`/${type}/${id}`, {
		language: 'en-GB',
		append_to_response: type === 'movie' ? 'watch/providers,release_dates' : 'watch/providers'
	});
	const providers = regionProviders(d['watch/providers']);
	const runtime =
		type === 'movie'
			? d.runtime || null
			: d.episode_run_time?.[0] || d.last_episode_to_air?.runtime || null;
	const t = now();
	run(
		`INSERT INTO titles (media_type, tmdb_id, title, original_title, release_date, status, runtime, seasons,
			genres, overview, poster_path, backdrop_path, providers, providers_link, details_at, providers_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (media_type, tmdb_id) DO UPDATE SET
			title = excluded.title, original_title = excluded.original_title,
			release_date = excluded.release_date, status = excluded.status, runtime = excluded.runtime,
			seasons = excluded.seasons, genres = excluded.genres, overview = excluded.overview,
			poster_path = excluded.poster_path, backdrop_path = excluded.backdrop_path,
			providers = excluded.providers, providers_link = excluded.providers_link,
			details_at = excluded.details_at, providers_at = excluded.providers_at`,
		[
			type,
			id,
			(type === 'movie' ? d.title : d.name) ?? '',
			(type === 'movie' ? d.original_title : d.original_name) ?? null,
			type === 'movie' ? localReleaseDate(d) : (d.first_air_date ?? null) || null,
			d.status ?? null,
			runtime,
			d.number_of_seasons ?? null,
			JSON.stringify((d.genres ?? []).map((g) => g.name)),
			d.overview || null,
			d.poster_path ?? null,
			d.backdrop_path ?? null,
			JSON.stringify(providers),
			providers.link,
			t,
			t
		]
	);
}

interface TitleRow {
	media_type: MediaType;
	tmdb_id: number;
	title: string;
	original_title: string | null;
	release_date: string | null;
	status: string | null;
	runtime: number | null;
	seasons: number | null;
	genres: string;
	overview: string | null;
	poster_path: string | null;
	backdrop_path: string | null;
	providers: string | null;
	details_at: string | null;
	providers_at: string | null;
}

function cleanProviders(p: Providers): Providers {
	return { ...p, link: safeLink(p.link) };
}

export function titleFromRow(r: TitleRow): Title {
	return {
		mediaType: r.media_type,
		tmdbId: r.tmdb_id,
		title: r.title,
		originalTitle: r.original_title,
		releaseDate: r.release_date,
		status: r.status,
		runtime: r.runtime,
		seasons: r.seasons,
		genres: JSON.parse(r.genres) as string[],
		overview: r.overview,
		posterPath: r.poster_path,
		backdropPath: r.backdrop_path,
		providers: r.providers ? cleanProviders(JSON.parse(r.providers) as Providers) : null
	};
}

export function cachedTitle(type: MediaType, id: number) {
	const row = get<TitleRow>('SELECT * FROM titles WHERE media_type = ? AND tmdb_id = ?', [
		type,
		id
	]);
	return row ? titleFromRow(row) : null;
}

export function isStale(type: MediaType, id: number) {
	const row = get<{ details_at: string | null; providers_at: string | null }>(
		'SELECT details_at, providers_at FROM titles WHERE media_type = ? AND tmdb_id = ?',
		[type, id]
	);
	if (!row?.details_at || !row.providers_at) return true;
	const age = (iso: string) => Date.now() - Date.parse(iso);
	return age(row.details_at) > DETAILS_MAX_AGE || age(row.providers_at) > PROVIDERS_MAX_AGE;
}

/** Makes sure the cache holds fresh details; quietly keeps old data if TMDB is down. */
export async function ensureDetails(type: MediaType, id: number) {
	if (!TMDB_ENABLED || !isStale(type, id)) return;
	try {
		await fetchDetails(type, id);
	} catch (e) {
		console.warn(`[tmdb] Could not refresh ${type}/${id}:`, (e as Error).message);
	}
}

// ---- Provider catalogue (for "My services") --------------------------------

export async function regionProviderCatalogue(): Promise<Provider[]> {
	if (!TMDB_ENABLED) return [];
	const cached = getSetting(`providers_${REGION}`);
	if (cached) {
		const { at, list } = JSON.parse(cached) as { at: string; list: Provider[] };
		if (Date.now() - Date.parse(at) < 1000 * 60 * 60 * 24 * 7) return list;
	}
	try {
		const [movie, tv] = await Promise.all(
			(['movie', 'tv'] as const).map((t) =>
				tmdb<{ results: RawProvider[] }>(`/watch/providers/${t}`, {
					watch_region: REGION,
					language: 'en-GB'
				})
			)
		);
		const byId = new Map<number, RawProvider & { score: number }>();
		for (const p of [...movie.results, ...tv.results]) {
			const prio = (p as RawProvider & { display_priorities?: Record<string, number> })
				.display_priorities?.[REGION];
			const score = prio ?? p.display_priority ?? 99;
			const existing = byId.get(p.provider_id);
			if (!existing || score < existing.score) byId.set(p.provider_id, { ...p, score });
		}
		const list = [...byId.values()]
			.filter((p) => baseName(p.provider_name) === p.provider_name)
			.sort((a, b) => a.score - b.score)
			.slice(0, 60)
			.map((p) => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path }));
		setSetting(`providers_${REGION}`, JSON.stringify({ at: now(), list }));
		return list;
	} catch (e) {
		console.warn('[tmdb] Could not load providers:', (e as Error).message);
		return cached ? (JSON.parse(cached) as { list: Provider[] }).list : [];
	}
}
