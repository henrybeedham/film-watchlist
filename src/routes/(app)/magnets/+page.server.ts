import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { appContext } from '#lib/server/context.js';
import { MAGNETS_ENABLED } from '#lib/server/magnets.js';
import { can } from '#lib/server/site.js';

export const load: PageServerLoad = ({ locals, url }) => {
	const { user } = appContext(locals, url);
	if (!MAGNETS_ENABLED || !can(user.id, 'magnets')) error(404, 'Not found');
};
