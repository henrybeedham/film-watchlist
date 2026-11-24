<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let busy = $state(false);
</script>

<svelte:head><title>Sign in · Watchlist</title></svelte:head>

<form
	method="POST"
	class="grid gap-5"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update();
			busy = false;
		};
	}}
>
	<h1 class="display text-3xl">Sign in</h1>
	<div class="grid gap-2">
		<Label for="email">Email</Label>
		<Input
			id="email"
			name="email"
			type="email"
			autocomplete="email"
			required
			value={form?.email ?? ''}
		/>
	</div>
	<div class="grid gap-2">
		<Label for="password">Password</Label>
		<Input id="password" name="password" type="password" autocomplete="current-password" required />
	</div>
	{#if form?.message}
		<p class="text-sm text-destructive" role="alert">{form.message}</p>
	{/if}
	<Button type="submit" size="lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
	<p class="text-sm text-muted-foreground">
		New here? Ask someone already using it for an invite link.
	</p>
</form>
