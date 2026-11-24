export const THEMES = [
	{
		id: 'programme',
		name: 'Repertory programme',
		blurb:
			'Cream paper, ink-black serif type and ticket-stub rows, like a printed cinema listings booklet.',
		view: 'rows'
	},
	{
		id: 'screening',
		name: 'Late-night screening',
		blurb: 'Dark room, velvet red and brass. Posters sit large in the rows.',
		view: 'rows'
	},
	{
		id: 'posters',
		name: 'Poster wall',
		blurb: 'Posters first, in a dense grid, with very little around them.',
		view: 'grid'
	},
	{
		id: 'catalogue',
		name: 'Collector’s catalogue',
		blurb: 'Numbered entries in tidy columns, like a boutique Blu-ray catalogue.',
		view: 'rows'
	}
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export type Mode = 'system' | 'light' | 'dark';
export type View = 'rows' | 'grid';

export const MODES: { id: Mode; name: string }[] = [
	{ id: 'system', name: 'Match device' },
	{ id: 'light', name: 'Light' },
	{ id: 'dark', name: 'Dark' }
];

export function isTheme(v: unknown): v is ThemeId {
	return THEMES.some((t) => t.id === v);
}
export function isMode(v: unknown): v is Mode {
	return v === 'system' || v === 'light' || v === 'dark';
}
export function defaultView(theme: ThemeId): View {
	return THEMES.find((t) => t.id === theme)?.view ?? 'rows';
}
