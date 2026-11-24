<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let busy = $state(false);
	const open = $derived(data.first || !!data.invite);
</script>

<svelte:head><title>Create an account · Watchlist</title></svelte:head>

{#if open}
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
		<div>
			<h1 class="display text-3xl">Create an account</h1>
			{#if data.invite}
				<p class="mt-2 text-muted-foreground">
					{#if data.invite.listName}
						{data.invite.invitedBy} has invited you to the list “{data.invite.listName}”.
					{:else}
						{data.invite.invitedBy} has invited you to Watchlist. You’ll start with a list of your own.
					{/if}
				</p>
			{:else}
				<p class="mt-2 text-muted-foreground">
					You’re the first person here, so this account will own the first list. Invite others from
					the Lists page afterwards.
				</p>
			{/if}
		</div>
		<input type="hidden" name="invite" value={data.invite?.token ?? ''} />
		{#if data.first && !data.invite}
			<div class="grid gap-2">
				<Label for="setup">Setup code</Label>
				<Input id="setup" name="setup" autocomplete="off" spellcheck="false" required />
				<p class="text-xs text-muted-foreground">
					Printed in the server log when the app starts, so only whoever runs it can claim the first
					account.
				</p>
			</div>
		{/if}
		<div class="grid gap-2">
			<Label for="name">Your name</Label>
			<Input id="name" name="name" autocomplete="name" required value={form?.name ?? ''} />
		</div>
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
			<Input
				id="password"
				name="password"
				type="password"
				autocomplete="new-password"
				minlength={8}
				maxlength={128}
				required
			/>
			<p class="text-xs text-muted-foreground">At least 8 characters.</p>
		</div>
		{#if form?.message}
			<p class="text-sm text-destructive" role="alert">{form.message}</p>
		{/if}
		<Button type="submit" size="lg" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
		<p class="text-sm text-muted-foreground">
			Already have an account? <a
				class="underline underline-offset-4"
				href="/signin{data.invite
					? `?next=${encodeURIComponent(`/invite/${data.invite.token}`)}`
					: ''}"
			>
				Sign in
			</a>
		</p>
	</form>
{:else}
	<div class="grid gap-4">
		<h1 class="display text-3xl">Invite only</h1>
		<p class="text-muted-foreground">
			{data.badInvite
				? 'That invite link has expired or has already been used. Ask the person who sent it for a new one.'
				: 'Accounts are by invitation. Ask someone already using Watchlist to send you an invite link.'}
		</p>
		<Button href="/signin" variant="outline" class="justify-self-start">Sign in</Button>
	</div>
{/if}
