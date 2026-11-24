// Reads a Letterboxd data export (the ZIP from letterboxd.com/settings/data, or its CSV files)
// into one record per film: whether it's on the watchlist, and each logged viewing with its rating
// and review. Runs in the browser so everything can be checked before it's saved.

import { titleKey } from './notes-parser';

export interface LetterboxdEntry {
	/** YYYY-MM-DD, or null when only a rating was given. */
	watchedOn: string | null;
	/** 1–10 (half stars). */
	rating: number | null;
	review: string | null;
}

export interface LetterboxdFilm {
	key: string;
	title: string;
	year: number | null;
	/** Watchlist films come in to watch; anything logged, rated or marked seen comes in watched. */
	status: 'want' | 'watched';
	/** When it was added to the watchlist or marked watched, YYYY-MM-DD. */
	addedOn: string | null;
	/** The most recent viewing, YYYY-MM-DD. */
	watchedOn: string | null;
	entries: LetterboxdEntry[];
}

/** The export files this reads. Everything else (lists, likes, deleted) is left alone. */
const WANTED = ['watchlist.csv', 'watched.csv', 'ratings.csv', 'diary.csv', 'reviews.csv'];
const SKIP_DIRS = new Set(['deleted', 'orphaned', 'likes', 'lists']);

/** The CSV name this path is, if it's one we read: "letterboxd-x/diary.csv" → "diary.csv". */
export function exportFileName(path: string): string | null {
	const parts = path.split('/').filter(Boolean);
	const name = parts.at(-1)?.toLowerCase() ?? '';
	if (!WANTED.includes(name)) return null;
	if (parts.slice(0, -1).some((p) => SKIP_DIRS.has(p.toLowerCase()) || p === '__MACOSX'))
		return null;
	return name;
}

// ---- ZIP ----------------------------------------------------------------------------------------

/** Reads the wanted CSVs out of a ZIP. Handles stored and deflated entries (all Letterboxd uses). */
export async function readZip(buffer: ArrayBuffer): Promise<Record<string, string>> {
	const view = new DataView(buffer);
	const bytes = new Uint8Array(buffer);
	// End of central directory: within the last 64 KB (the comment can be up to 65535 bytes).
	let eocd = -1;
	for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
		if (view.getUint32(i, true) === 0x06054b50) {
			eocd = i;
			break;
		}
	}
	if (eocd < 0) throw new Error('That isn’t a ZIP file.');
	const count = view.getUint16(eocd + 10, true);
	let p = view.getUint32(eocd + 16, true);
	const out: Record<string, string> = {};
	const utf8 = new TextDecoder('utf-8');

	for (let n = 0; n < count; n++) {
		if (view.getUint32(p, true) !== 0x02014b50) throw new Error('The ZIP file looks damaged.');
		const method = view.getUint16(p + 10, true);
		const size = view.getUint32(p + 20, true);
		const nameLen = view.getUint16(p + 28, true);
		const extraLen = view.getUint16(p + 30, true);
		const commentLen = view.getUint16(p + 32, true);
		const local = view.getUint32(p + 42, true);
		const name = exportFileName(utf8.decode(bytes.subarray(p + 46, p + 46 + nameLen)));
		p += 46 + nameLen + extraLen + commentLen;
		if (!name || name in out) continue;

		const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
		const data = bytes.subarray(start, start + size);
		if (method === 0) out[name] = utf8.decode(data);
		else if (method === 8) {
			const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
			out[name] = await new Response(stream).text();
		} else throw new Error('The ZIP file uses a compression this can’t read.');
	}
	return out;
}

// ---- CSV ----------------------------------------------------------------------------------------

/** RFC 4180: quoted fields, doubled quotes, line breaks inside quotes. */
export function parseCsv(text: string): Record<string, string>[] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	const src = text.replace(/^\uFEFF/, '');
	for (let i = 0; i < src.length; i++) {
		const c = src[i];
		if (quoted) {
			if (c === '"') {
				if (src[i + 1] === '"') {
					field += '"';
					i++;
				} else quoted = false;
			} else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ',') {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && src[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else field += c;
	}
	if (field || row.length) {
		row.push(field);
		rows.push(row);
	}
	const [header, ...body] = rows.filter((r) => r.some((f) => f.trim()));
	if (!header) return [];
	const keys = header.map((h) => h.trim());
	return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

// ---- Films --------------------------------------------------------------------------------------

const isoDate = (s: string | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);

/** Letterboxd's 0.5–5 stars as 1–10. */
function rating(s: string | undefined): number | null {
	const n = Math.round(Number(s) * 2);
	return Number.isInteger(n) && n >= 1 && n <= 10 ? n : null;
}

/** Reviews can carry a little HTML (<i>, <b>, <br />). Keep the words and the line breaks. */
function plainReview(s: string | undefined): string | null {
	if (!s) return null;
	const text = s
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>\s*<p>/gi, '\n\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;/g, '’')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
	return text.slice(0, 4000) || null;
}

const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);
const earlier = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);

/** Combines the export's CSVs (keyed by file name) into one record per film. */
export function readExport(files: Record<string, string>): LetterboxdFilm[] {
	const films = new Map<string, LetterboxdFilm & { seen: boolean; filmRating: number | null }>();
	const film = (r: Record<string, string>) => {
		const title = r['Name'];
		if (!title) return null;
		const year = Number(r['Year']) || null;
		const key = `${titleKey(title)}|${year ?? ''}`;
		let f = films.get(key);
		if (!f) {
			f = {
				key,
				title,
				year,
				status: 'want',
				addedOn: null,
				watchedOn: null,
				entries: [],
				seen: false,
				filmRating: null
			};
			films.set(key, f);
		}
		return f;
	};
	const rows = (name: string) => (files[name] ? parseCsv(files[name]) : []);

	for (const r of rows('watchlist.csv')) {
		const f = film(r);
		if (!f) continue;
		f.addedOn = earlier(f.addedOn, isoDate(r['Date']));
	}
	for (const r of rows('watched.csv')) {
		const f = film(r);
		if (!f) continue;
		f.seen = true;
		f.addedOn = earlier(f.addedOn, isoDate(r['Date']));
	}
	for (const r of rows('ratings.csv')) {
		const f = film(r);
		if (!f) continue;
		f.seen = true;
		f.filmRating = rating(r['Rating']);
	}

	// A review is a diary entry with words, and shares its Letterboxd link. Reviews of films that
	// were never logged with a date only appear in reviews.csv.
	const reviews = new Map<string, Record<string, string>>();
	for (const r of rows('reviews.csv')) reviews.set(r['Letterboxd URI'] || crypto.randomUUID(), r);

	const log = (r: Record<string, string>, review: string | undefined) => {
		const f = film(r);
		if (!f) return;
		f.seen = true;
		const watchedOn = isoDate(r['Watched Date']) ?? isoDate(r['Date']);
		f.entries.push({ watchedOn, rating: rating(r['Rating']), review: plainReview(review) });
		f.watchedOn = later(f.watchedOn, watchedOn);
	};
	for (const r of rows('diary.csv')) {
		const uri = r['Letterboxd URI'];
		const review = uri ? reviews.get(uri) : undefined;
		if (uri) reviews.delete(uri);
		log(r, review?.['Review']);
	}
	for (const r of reviews.values()) log(r, r['Review']);

	return [...films.values()].map(({ seen, filmRating, ...f }) => {
		if (!seen) return f;
		const entries = f.entries.sort((a, b) => (b.watchedOn ?? '').localeCompare(a.watchedOn ?? ''));
		// The film's overall rating goes on the latest viewing, or on an undated one if never logged.
		if (filmRating && !entries.some((e) => e.rating)) {
			if (entries[0]) entries[0].rating = filmRating;
			else entries.push({ watchedOn: null, rating: filmRating, review: null });
		}
		return { ...f, status: 'watched' as const, entries };
	});
}

/** Everything in one go: a ZIP, or one or more of its CSVs. */
export async function readExportFiles(files: File[]): Promise<LetterboxdFilm[]> {
	const texts: Record<string, string> = {};
	for (const file of files) {
		if (/\.zip$/i.test(file.name) || file.type.includes('zip')) {
			Object.assign(texts, await readZip(await file.arrayBuffer()));
		} else {
			const name = exportFileName(file.name);
			if (name) texts[name] = await file.text();
		}
	}
	if (Object.keys(texts).length === 0) {
		throw new Error(
			'Couldn’t find watchlist.csv, watched.csv or diary.csv. Choose the ZIP from Letterboxd.'
		);
	}
	return readExport(texts);
}
