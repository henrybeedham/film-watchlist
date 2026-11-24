<script lang="ts">
	import { page } from '$app/state';
	import Wordmark from '#lib/components/Wordmark.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Not found' : 'Something went wrong'} · Watchlist</title>
</svelte:head>

<main class="mx-auto grid min-h-dvh max-w-xl content-center gap-5 px-4 py-10">
	<a href="/" class="text-2xl"><Wordmark /></a>
	<p class="label figures">Error {page.status}</p>
	<h1 class="display text-4xl sm:text-5xl">
		{page.status === 404 ? 'This reel is missing' : 'The projector jammed'}
	</h1>
	<p class="text-muted-foreground">
		{page.error?.message && page.status < 500
			? page.error.message
			: page.status === 404
				? 'There’s nothing at this address. It may have been removed, or the link is mistyped.'
				: 'Something went wrong on our side. Try again in a moment.'}
	</p>
	<Button href="/" variant="outline" class="justify-self-start">Back to the list</Button>
</main>
