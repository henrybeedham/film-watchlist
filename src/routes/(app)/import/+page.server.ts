import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { appContext, listContext } from '#lib/server/context.js';
import { cleanFilm, importFilms, listTitlesForImport } from '#lib/server/letterboxd.js';
import { kickEnrichment } from '#lib/server/enrich.js';
import { text } from '#lib/server/form.js';

export const load: PageServerLoad = ({ locals, url }) => {
	const { listId } = appContext(locals, url);
	return { existing: listId === null ? [] : listTitlesForImport(listId) };
};

export const actions: Actions = {
	/** One batch of films; the page sends a large export in several. */
	commit: async ({ request, locals }) => {
		const { user, listId } = listContext(locals);
		const f = await request.formData();
		let raw: unknown[];
		try {
			raw = JSON.parse(text(f, 'films') || '[]') as unknown[];
			if (!Array.isArray(raw) || raw.length > 1000) throw new Error();
		} catch {
			return fail(400, { message: 'Couldn’t read the import. Choose the file again.' });
		}
		const films = raw.map(cleanFilm).filter((x) => x !== null);
		const result = importFilms(listId, user.id, films);
		kickEnrichment();
		return result;
	}
};
