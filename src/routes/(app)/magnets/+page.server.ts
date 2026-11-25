import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { MAGNETS_ENABLED } from '#lib/server/magnets.js';

export const load: PageServerLoad = () => {
	if (!MAGNETS_ENABLED) error(404, 'Magnet search is off.');
};
