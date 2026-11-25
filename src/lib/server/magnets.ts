// Magnet link search through torlnk's headless `search` command, which asks several public
// torrent indexes at once and prints one JSON document. torlnk has no library API, so it runs as
// a child process on the same Node binary as the app.
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Item, MagnetResult, MediaType } from '#lib/types.js';

interface TorlnkOutput {
	results?: {
		name?: unknown;
		magnet?: unknown;
		sizeBytes?: unknown;
		seeders?: unknown;
		source?: unknown;
	}[];
}

const CLI = (() => {
	try {
		const pkg = createRequire(import.meta.url).resolve('torlnk/package.json');
		return join(dirname(pkg), 'dist', 'cli.cjs');
	} catch {
		return null;
	}
})();

export const MAGNETS_ENABLED =
	CLI !== null && !['0', 'off', 'false', 'no'].includes((process.env.MAGNET_SEARCH ?? '').trim());

const TTL = 30 * 60_000;
const MAX_RESULTS = 8;
const cache = new Map<string, { at: number; results: Promise<MagnetResult[]> }>();

export interface MagnetQuery {
	query: string;
	category: MediaType;
	/** Ranks releases of that year first. Kept out of the query: YTS finds nothing with it. */
	year: number | null;
}

function clean(title: string) {
	return title
		.replace(/[:'’"]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^-+\s*/, '')
		.slice(0, 120);
}

/** The search for an item on a list: its title, and its year for films. */
export function itemQuery(item: Item): MagnetQuery {
	const category = item.mediaType ?? item.kindHint ?? 'movie';
	const year = Number(item.releaseDate?.slice(0, 4)) || item.yearHint || null;
	return { query: clean(item.displayTitle), category, year: category === 'movie' ? year : null };
}

/** The search for typed text; a year at the end, as in “Dune 2021”, is used for ranking. */
export function textQuery(text: string, category: MediaType): MagnetQuery {
	const m = /^(.*\S)\s+\(?((?:19|20)\d\d)\)?$/.exec(text.trim());
	return m
		? { query: clean(m[1]), category, year: Number(m[2]) }
		: { query: clean(text), category, year: null };
}

/**
 * Best-seeded results first, with that year’s releases ahead of the rest. Concurrent and
 * repeated searches for the same text share one run.
 */
export async function findMagnets({ query, category, year }: MagnetQuery): Promise<MagnetResult[]> {
	const key = `${category}:${query.toLowerCase()}`;
	let entry = cache.get(key);
	if (!entry || Date.now() - entry.at >= TTL) {
		for (const [k, v] of cache) if (Date.now() - v.at >= TTL) cache.delete(k);
		entry = { at: Date.now(), results: run(query, category) };
		cache.set(key, entry);
		entry.results.catch(() => cache.delete(key));
	}
	const results = await entry.results;
	if (!year) return results.slice(0, MAX_RESULTS);
	const ofYear = (r: MagnetResult) => (r.name.includes(String(year)) ? 0 : 1);
	return [...results].sort((a, b) => ofYear(a) - ofYear(b)).slice(0, MAX_RESULTS);
}

function run(query: string, category: MediaType): Promise<MagnetResult[]> {
	if (!CLI) return Promise.reject(new Error('torlnk is not installed'));
	const args = [
		CLI,
		'search',
		query,
		'--category',
		category === 'movie' ? 'movies' : 'tv',
		'--timeout',
		'20s'
	];
	return new Promise((resolve, reject) => {
		execFile(
			process.execPath,
			args,
			{
				timeout: 30_000,
				maxBuffer: 8 * 1024 * 1024,
				// No WebRTC native module or update check: search only needs HTTP.
				env: { ...process.env, TORLINK_NO_WEBRTC: '1', TORLINK_NO_UPDATE_CHECK: '1' }
			},
			(err, stdout) => {
				let parsed: TorlnkOutput;
				try {
					parsed = JSON.parse(stdout) as TorlnkOutput;
				} catch {
					// Exit 1 with no JSON means no index answered at all.
					return reject(err ?? new Error('torlnk printed no results'));
				}
				resolve(tidy(parsed));
			}
		);
	});
}

function tidy(out: TorlnkOutput): MagnetResult[] {
	const seen = new Set<string>();
	return (out.results ?? [])
		.flatMap((r) => {
			if (typeof r.magnet !== 'string' || !r.magnet.startsWith('magnet:?')) return [];
			if (typeof r.name !== 'string') return [];
			const hash = /btih:([a-z0-9]+)/i.exec(r.magnet)?.[1]?.toLowerCase() ?? r.magnet;
			if (seen.has(hash)) return [];
			seen.add(hash);
			return [
				{
					name: r.name,
					magnet: r.magnet,
					sizeBytes: typeof r.sizeBytes === 'number' ? r.sizeBytes : null,
					seeders: typeof r.seeders === 'number' ? r.seeders : 0,
					source: typeof r.source === 'string' ? r.source : ''
				}
			];
		})
		.sort((a, b) => b.seeders - a.seeders);
}
