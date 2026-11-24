// Per-person settings: theme, light/dark, list view, current list and streaming services.
import { get, run } from './db';
import { userLists } from './lists';
import { defaultView, isMode, isTheme, type Mode, type ThemeId, type View } from '#lib/themes.js';

export interface Prefs {
	theme: ThemeId;
	mode: Mode;
	view: View;
	currentListId: number | null;
	services: string[];
}

interface PrefsRow {
	theme: string;
	mode: string;
	view: string | null;
	current_list_id: number | null;
	services: string;
}

export function getPrefs(userId: string): Prefs {
	const row = get<PrefsRow>('SELECT * FROM prefs WHERE user_id = ?', userId);
	const theme = isTheme(row?.theme) ? row.theme : 'programme';
	return {
		theme,
		mode: isMode(row?.mode) ? row.mode : 'system',
		view: row?.view === 'rows' || row?.view === 'grid' ? row.view : defaultView(theme),
		currentListId: row?.current_list_id ?? null,
		services: row
			? (JSON.parse(row.services) as unknown[]).filter((s): s is string => typeof s === 'string')
			: []
	};
}

type Patch = Partial<{
	theme: ThemeId;
	mode: Mode;
	view: View | null;
	currentListId: number | null;
	services: string[];
}>;

export function setPrefs(userId: string, patch: Patch) {
	run('INSERT INTO prefs (user_id) VALUES (?) ON CONFLICT DO NOTHING', userId);
	const cols: Record<string, unknown> = {
		theme: patch.theme,
		mode: patch.mode,
		view: patch.view,
		current_list_id: patch.currentListId,
		services: patch.services ? JSON.stringify(patch.services) : undefined
	};
	for (const [col, value] of Object.entries(cols)) {
		if (value === undefined) continue;
		run(`UPDATE prefs SET ${col} = ? WHERE user_id = ?`, [value as string | number | null, userId]);
	}
}

/** The list the person is looking at, falling back to their first list. */
export function currentListId(userId: string, prefs: Prefs): number | null {
	const lists = userLists(userId);
	if (prefs.currentListId && lists.some((l) => l.id === prefs.currentListId)) {
		return prefs.currentListId;
	}
	return lists[0]?.id ?? null;
}
