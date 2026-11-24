import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { appContext, listContext } from '#lib/server/context.js';
import { addItems, bumpMentions, existingKeys, type NewItem } from '#lib/server/items.js';
import { kickEnrichment } from '#lib/server/enrich.js';
import { transaction } from '#lib/server/db.js';
import { text as field } from '#lib/server/form.js';

export const load: PageServerLoad = ({ locals, url }) => {
	const { listId } = appContext(locals, url);
	const existing = listId === null ? [] : [...existingKeys(listId).entries()];
	return { existing: existing.map(([key, v]) => ({ key, ...v })) };
};

interface IncomingRow {
	action: 'add' | 'skip' | 'bump';
	title: string;
	yearHint: number | null;
	kindHint: 'movie' | 'tv' | null;
	mentions: number;
	recommendedBy: string | null;
	note: string | null;
	watched: boolean;
	existingId: number | null;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export const actions: Actions = {
	commit: async ({ request, locals }) => {
		const { user, listId } = listContext(locals);
		const f = await request.formData();
		let rows: IncomingRow[];
		try {
			rows = JSON.parse(field(f, 'rows') || '[]') as IncomingRow[];
			if (!Array.isArray(rows) || rows.length > 2000) throw new Error();
		} catch {
			return fail(400, { message: 'Couldn’t read the import. Paste the list again.' });
		}

		const existing = new Set([...existingKeys(listId).values()].map((v) => v.id));
		const toAdd: NewItem[] = [];
		let bumped = 0;
		for (const r of rows) {
			const title = text(r.title, 200);
			if (!title || r.action === 'skip') continue;
			const mentions = Math.max(1, Math.min(99, Math.round(Number(r.mentions) || 1)));
			if (r.action === 'bump' && r.existingId && existing.has(r.existingId)) {
				bumpMentions(r.existingId, mentions);
				bumped++;
				continue;
			}
			const year = Number(r.yearHint);
			toAdd.push({
				title,
				yearHint: Number.isInteger(year) && year > 1880 && year < 2100 ? year : null,
				kindHint: r.kindHint === 'movie' || r.kindHint === 'tv' ? r.kindHint : null,
				mentions,
				recommendedBy: text(r.recommendedBy, 100) || null,
				note: text(r.note, 1000) || null,
				watched: r.watched === true
			});
		}
		transaction(() => addItems(listId, user.id, toAdd));
		kickEnrichment();
		return { added: toAdd.length, bumped };
	}
};
