// Form actions shared by every page that shows titles. Each one checks membership itself.
import { fail } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { listContext } from './context';
import {
	addDiary,
	addItems,
	bumpMentions,
	deleteDiary,
	existingKeys,
	findOnListByTmdb,
	markUnwatched,
	markWatched,
	requireItem,
	type WatchLog
} from './items';
import { kickEnrichment } from './enrich';
import { ensureDetails } from './tmdb';
import { setPrefs } from './prefs';
import { titleKey } from '#lib/notes-parser.js';
import { parseLine } from '#lib/notes-parser.js';
import type { MediaType } from '#lib/types.js';
import { text } from './form';

const str = (f: FormData, k: string) => text(f, k).trim();
export const isTmdbId = (n: number) => Number.isSafeInteger(n) && n > 0;

function readLog(f: FormData): WatchLog {
	const date = str(f, 'watchedOn');
	const rating = Number(str(f, 'rating'));
	return {
		watchedOn: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
		rating: Number.isInteger(rating) && rating >= 1 && rating <= 10 ? rating : null,
		review: str(f, 'review').slice(0, 4000) || null
	};
}

export const itemActions = {
	/** Quick add: a typed title, or a TMDB result picked from suggestions. */
	add: async ({ request, locals }: RequestEvent) => {
		const { user, listId } = listContext(locals);
		const f = await request.formData();
		const typed = str(f, 'title');
		const mediaType = str(f, 'mediaType') as MediaType;
		const tmdbId = Number(str(f, 'tmdbId'));
		const picked = (mediaType === 'movie' || mediaType === 'tv') && isTmdbId(tmdbId);
		if (!typed) return fail(400, { message: 'Type a title to add.' });

		if (picked) {
			const existing = findOnListByTmdb(listId, mediaType, tmdbId);
			if (existing) {
				bumpMentions(existing.id);
				return { added: false, bumped: true, title: typed };
			}
		}
		const parsed = parseLine(typed, null);
		if (!picked) {
			const dupe = existingKeys(listId).get(titleKey(parsed.title));
			if (dupe && str(f, 'force') !== '1') {
				return fail(409, {
					duplicate: dupe,
					title: typed,
					message: `“${dupe.title}” is already on this list.`
				});
			}
		}
		addItems(listId, user.id, [
			{
				title: picked ? typed : parsed.title,
				yearHint: parsed.yearHint,
				kindHint: parsed.kindHint,
				mentions: parsed.mentions,
				recommendedBy: str(f, 'recommendedBy') || parsed.recommendedBy,
				note: parsed.note,
				tmdb: picked ? { mediaType, tmdbId } : null
			}
		]);
		// A picked result is stored as matched, so the background matcher skips it.
		// Fetch its details now so the poster is there when the list reloads.
		if (picked) await ensureDetails(mediaType, tmdbId);
		else kickEnrichment();
		return { added: true, title: picked ? typed : parsed.title };
	},

	mention: async ({ request, locals }: RequestEvent) => {
		const { listIds } = listContext(locals);
		const f = await request.formData();
		const item = requireItem(Number(f.get('itemId')), listIds);
		bumpMentions(item.id, str(f, 'delta') === '-1' ? -1 : 1);
		return { ok: true };
	},

	watched: async ({ request, locals }: RequestEvent) => {
		const { user, listIds } = listContext(locals);
		const f = await request.formData();
		const item = requireItem(Number(f.get('itemId')), listIds);
		const log = str(f, 'skipDiary') === '1' ? null : readLog(f);
		if (item.status === 'watched' && log) addDiary(item.id, user.id, log);
		else markWatched(item.id, user.id, log);
		return { watched: item.id, title: item.displayTitle };
	},

	unwatch: async ({ request, locals }: RequestEvent) => {
		const { listIds } = listContext(locals);
		const f = await request.formData();
		const item = requireItem(Number(f.get('itemId')), listIds);
		markUnwatched(item.id);
		return { unwatched: item.id };
	},

	deleteDiary: async ({ request, locals }: RequestEvent) => {
		const { user } = listContext(locals);
		const f = await request.formData();
		deleteDiary(Number(f.get('diaryId')), user.id);
		return { ok: true };
	},

	view: async ({ request, locals }: RequestEvent) => {
		const { user } = listContext(locals);
		const f = await request.formData();
		const view = str(f, 'view');
		if (view === 'rows' || view === 'grid') setPrefs(user.id, { view });
		return { ok: true };
	}
};
