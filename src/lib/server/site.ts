// Site-wide settings, chosen by the site's admin: the first account, made with the setup code.
import { get, getSetting, setSetting } from './db';
import { isTheme, type ThemeId } from '#lib/themes.js';

export function siteTheme(): ThemeId {
	const t = getSetting('site_theme');
	return isTheme(t) ? t : 'programme';
}

export function setSiteTheme(theme: ThemeId) {
	setSetting('site_theme', theme);
}

export function isSiteAdmin(userId: string) {
	const first = get<{ id: string }>('SELECT id FROM "user" ORDER BY "createdAt", rowid LIMIT 1');
	return first?.id === userId;
}
