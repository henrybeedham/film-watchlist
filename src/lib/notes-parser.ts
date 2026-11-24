// Turns a pasted Apple Notes checklist (or any one-title-per-line list) into rows to import.
// Pure and dependency-free so it can be checked in isolation.

import type { MediaType } from './types';

export interface ParsedRow {
	line: number;
	raw: string;
	title: string;
	yearHint: number | null;
	kindHint: MediaType | null;
	mentions: number;
	recommendedBy: string | null;
	note: string | null;
	watched: boolean;
}

export interface ParseResult {
	heading: string | null;
	rows: ParsedRow[];
}

const CHECKBOX = /^\s*(?:[-*•◦]\s*)?\[( |x|X|✓|✔)\]\s*/;
const SYMBOL_BOX = /^\s*([☐□○◯☑☒✅✓✔])\s*/;
const BULLET = /^\s*(?:[-*•◦–]|\d{1,3}[.)])\s+/;
const UP_ARROW = /(?:⬆️|⬆|↑|⤴️|⤴)️?/g;
const DASH_SPLIT = /\s+[-–—]\s+/;
const MAX_YEAR = new Date().getFullYear() + 3;

const isYear = (n: number) => n >= 1888 && n <= MAX_YEAR;

/** Lower-case, accent-free, article-free key for spotting duplicates. */
export function titleKey(title: string): string {
	return title
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, 'and')
		.replace(/^(the|a|an)\s+/, '')
		.replace(/[^a-z0-9]/g, '')
		.replace(/s$/, '');
}

function tidyTitle(t: string): string {
	let out = t.replace(/\s+/g, ' ').replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, '');
	const letters = out.replace(/[^A-Za-z]/g, '');
	if (letters.length > 3 && letters === letters.toUpperCase()) {
		// SHOUTING → Title Case
		out = out.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
	} else if (/^\p{Ll}/u.test(out)) {
		out = out[0].toUpperCase() + out.slice(1);
	}
	return out;
}

function kindFrom(text: string): MediaType | null {
	if (/\b(movie|film)\b/i.test(text)) return 'movie';
	if (/\b(series|tv|show|season|sitcom|miniseries)\b/i.test(text)) return 'tv';
	return null;
}

export function parseLine(input: string, previousTitle: string | null) {
	let text = input;
	let watched = false;
	let marked = false;

	const box = text.match(CHECKBOX);
	if (box) {
		watched = box[1].trim() !== '';
		marked = true;
		text = text.slice(box[0].length);
	} else {
		const sym = text.match(SYMBOL_BOX);
		if (sym) {
			watched = !/[☐□○◯]/.test(sym[1]);
			marked = true;
			text = text.slice(sym[0].length);
		} else {
			const bullet = text.match(BULLET);
			if (bullet) {
				marked = true;
				text = text.slice(bullet[0].length);
			}
		}
	}

	const notes: string[] = [];
	let yearHint: number | null = null;
	let mentions = 1;
	let recommendedBy: string | null = null;

	// "x2", "×3": how many times it has been suggested.
	text = text.replace(/\s+[x×]\s?(\d{1,2})\b/i, (_, n: string) => {
		mentions = Math.max(1, Math.min(99, Number(n)));
		return ' ';
	});

	// "better than ⬆️" points at the line above.
	if (previousTitle) text = text.replace(UP_ARROW, previousTitle);

	// "(Hugh recommendation)", "(recommended by Hugh)", "(rec by Hugh)"
	text = text.replace(
		/\(\s*(?:(.+?)\s+recommendation|(?:recommended|rec'?d?)\s+by\s+(.+?))\s*\)/i,
		(_, a?: string, b?: string) => {
			recommendedBy = tidyTitle((a ?? b ?? '').trim());
			return ' ';
		}
	);

	// "Talk to me (2023) Horror": a year in brackets, then a trailing note.
	const yearParen = text.match(/^(.*?)\s*\((\d{4})\)\s*(.*)$/);
	if (yearParen && isYear(Number(yearParen[2]))) {
		yearHint = Number(yearParen[2]);
		text = yearParen[1];
		if (yearParen[3].trim()) notes.push(yearParen[3].trim());
	}

	// Any other bracketed text is a note.
	text = text.replace(/\(([^)]*)\)/g, (_, inner: string) => {
		if (inner.trim()) notes.push(inner.trim());
		return ' ';
	});

	// "Spaceman - spider movie": title, then a note.
	const parts = text.split(DASH_SPLIT);
	if (parts.length > 1) {
		text = parts[0];
		notes.unshift(parts.slice(1).join(' – ').trim());
	}

	// "Tip to tip , tip2tip": an alternative name after a spaced comma.
	const alias = text.match(/\s+,\s*(.+)$/);
	if (alias) {
		text = text.slice(0, alias.index);
		notes.unshift(`Also known as ${alias[1].trim()}`);
	}

	// "Send help 2024": a trailing year (but keep "Blade Runner 2049").
	const trailingYear = text.trim().match(/^(.+?)\s+((?:18|19|20)\d{2})$/);
	if (trailingYear && isYear(Number(trailingYear[2])) && yearHint === null) {
		yearHint = Number(trailingYear[2]);
		text = trailingYear[1];
	}

	const note = notes.filter(Boolean).join('; ') || null;
	if (yearHint === null && note) {
		const y = note.match(/\b((?:19|20)\d{2})\b/);
		if (y && isYear(Number(y[1]))) yearHint = Number(y[1]);
	}

	return {
		marked,
		title: tidyTitle(text),
		yearHint,
		kindHint: note ? kindFrom(note) : null,
		mentions,
		recommendedBy,
		note,
		watched
	};
}

export function parseNotes(input: string): ParseResult {
	const lines = input.replace(/\r\n?/g, '\n').split('\n');
	const nonEmpty = lines.filter((l) => l.trim());
	const markedCount = nonEmpty.filter(
		(l) => CHECKBOX.test(l) || SYMBOL_BOX.test(l) || BULLET.test(l)
	).length;
	const mostlyMarked = markedCount >= nonEmpty.length / 2;

	let heading: string | null = null;
	const rows: ParsedRow[] = [];
	let previousTitle: string | null = null;

	lines.forEach((raw, i) => {
		if (!raw.trim()) return;
		const parsed = parseLine(raw, previousTitle);
		// In a checklist, an unmarked first line is the note's title ("Film").
		if (!parsed.marked && mostlyMarked && rows.length === 0 && heading === null) {
			heading = raw.trim();
			return;
		}
		if (!parsed.title) return;
		rows.push({
			line: i + 1,
			raw: raw.trim(),
			title: parsed.title,
			yearHint: parsed.yearHint,
			kindHint: parsed.kindHint,
			mentions: parsed.mentions,
			recommendedBy: parsed.recommendedBy,
			note: parsed.note,
			watched: parsed.watched
		});
		previousTitle = parsed.title;
	});

	return { heading, rows };
}
