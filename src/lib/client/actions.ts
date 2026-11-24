// Calls a SvelteKit form action from script (e.g. an Undo button in a toast).
import { deserialize } from '$app/forms';
import { invalidateAll } from '$app/navigation';

export async function postAction(action: string, fields: Record<string, string | number>) {
	const body = new FormData();
	for (const [k, v] of Object.entries(fields)) body.set(k, String(v));
	const res = await fetch(action, {
		method: 'POST',
		body,
		headers: { 'x-sveltekit-action': 'true' }
	});
	const result = deserialize(await res.text());
	await invalidateAll();
	return result;
}
