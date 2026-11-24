<script lang="ts">
	import Wordmark from '#lib/components/Wordmark.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>Invitation · Watchlist</title></svelte:head>

<main class="mx-auto grid min-h-dvh max-w-xl content-center gap-6 px-4 py-10">
	<Wordmark class="text-3xl" />
	{#if !data.invite}
		<h1 class="display text-4xl">This invite has expired</h1>
		<p class="text-muted-foreground">
			Invite links work once and last seven days. Ask the person who sent it for a new one.
		</p>
		<Button href="/" variant="outline" class="justify-self-start">Go to Watchlist</Button>
	{:else}
		<p class="label">An invitation</p>
		<h1 class="display text-4xl">
			{data.invite.invitedBy} has invited you to {data.invite.listName
				? `“${data.invite.listName}”`
				: 'Watchlist'}
		</h1>
		<p class="text-muted-foreground">
			{data.invite.listName
				? 'You’ll be able to add titles, tick them off and rate what you’ve watched.'
				: 'Make an account to keep your own lists of films and series to watch, and share them with others.'}
		</p>
		{#if data.already}
			<p>
				{data.invite.listName ? 'You’re already on this list.' : 'You already have an account.'}
			</p>
			<Button href="/" class="justify-self-start">
				{data.invite.listName ? 'Open it' : 'Go to Watchlist'}
			</Button>
		{:else if data.user}
			<form method="POST">
				<Button type="submit" size="lg">Join as {data.user.name}</Button>
			</form>
			{#if form?.message}<p class="text-sm text-destructive">{form.message}</p>{/if}
		{:else}
			<div class="flex flex-wrap gap-2">
				<Button href="/signup?invite={data.token}" size="lg">Create an account</Button>
				<Button href="/signin?next=/invite/{data.token}" size="lg" variant="outline">
					I already have one
				</Button>
			</div>
		{/if}
	{/if}
</main>
