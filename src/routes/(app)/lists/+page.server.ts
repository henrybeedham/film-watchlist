import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { appContext } from '#lib/server/context.js';
import {
	createInvite,
	createList,
	deleteList,
	getList,
	members,
	openInvites,
	removeMember,
	renameList,
	requireMember,
	requireOwner,
	revokeInvite,
	setShareToken
} from '#lib/server/lists.js';
import { setPrefs } from '#lib/server/prefs.js';
import { text } from '#lib/server/form.js';

export const load: PageServerLoad = ({ locals, url }) => {
	const { user, lists, listId } = appContext(locals, url);
	const chosen = Number(url.searchParams.get('list')) || listId;
	if (!chosen) return { manage: null, origin: url.origin };
	const role = requireMember(chosen, user.id);
	const list = getList(chosen)!;
	return {
		origin: url.origin,
		manage: {
			id: list.id,
			name: list.name,
			role,
			shareToken: role === 'owner' ? list.share_token : null,
			shared: !!list.share_token,
			members: members(list.id),
			invites: role === 'owner' ? openInvites(list.id) : []
		},
		lists
	};
};

const listIdFrom = (f: FormData) => Number(f.get('listId'));
const nameFrom = (f: FormData) => text(f, 'name').trim().slice(0, 80);

export const actions: Actions = {
	switch: ({ locals, request }) =>
		request.formData().then((f) => {
			const { user } = appContext(locals);
			const id = listIdFrom(f);
			requireMember(id, user.id);
			setPrefs(user.id, { currentListId: id });
			return { switched: id };
		}),

	create: async ({ locals, request }) => {
		const { user } = appContext(locals);
		const name = nameFrom(await request.formData());
		if (!name) return fail(400, { createMessage: 'Give the list a name.' });
		const id = createList(user.id, name);
		setPrefs(user.id, { currentListId: id });
		redirect(303, `/lists?list=${id}`);
	},

	rename: async ({ locals, request }) => {
		const { user } = appContext(locals);
		const f = await request.formData();
		const id = listIdFrom(f);
		requireOwner(id, user.id);
		const name = nameFrom(f);
		if (!name) return fail(400, { renameMessage: 'The name can’t be empty.' });
		renameList(id, name);
		return { renamed: true };
	},

	invite: async ({ locals, request }) => {
		const { user } = appContext(locals);
		const id = listIdFrom(await request.formData());
		requireOwner(id, user.id);
		return { invite: createInvite(id, user.id) };
	},

	revokeInvite: async ({ locals, request }) => {
		const { user } = appContext(locals);
		const f = await request.formData();
		const id = listIdFrom(f);
		requireOwner(id, user.id);
		revokeInvite(id, text(f, 'token'));
		return { revoked: true };
	},

	share: async ({ locals, request }) => {
		const { user } = appContext(locals);
		const f = await request.formData();
		const id = listIdFrom(f);
		requireOwner(id, user.id);
		setShareToken(id, f.get('on') === '1');
		return { shareChanged: true };
	},

	removeMember: async ({ locals, request }) => {
		const { user } = appContext(locals);
		const f = await request.formData();
		const id = listIdFrom(f);
		requireOwner(id, user.id);
		removeMember(id, text(f, 'userId'));
		return { removed: true };
	},

	leave: async ({ locals, request }) => {
		const { user } = appContext(locals);
		const id = listIdFrom(await request.formData());
		if (requireMember(id, user.id) === 'owner') {
			return fail(400, { leaveMessage: 'Owners can’t leave their own list. Delete it instead.' });
		}
		removeMember(id, user.id);
		redirect(303, '/lists');
	},

	delete: async ({ locals, request }) => {
		const { user } = appContext(locals);
		const f = await request.formData();
		const id = listIdFrom(f);
		requireOwner(id, user.id);
		if (text(f, 'confirm').trim() !== getList(id)?.name) {
			return fail(400, { deleteMessage: 'Type the list’s name exactly to delete it.' });
		}
		deleteList(id);
		redirect(303, '/lists');
	}
};
