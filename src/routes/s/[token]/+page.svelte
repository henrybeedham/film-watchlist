<script lang="ts">
	import Wordmark from '#lib/components/Wordmark.svelte';
	import ItemBrowser from '#lib/components/ItemBrowser.svelte';
	import { plural } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let tab = $state<'want' | 'soon' | 'watched'>('want');
	const tabs = $derived(
		[
			['want', 'To watch', data.want.length],
			['soon', 'Coming soon', data.soon.length],
			['watched', 'Watched', data.watched.length]
		].filter(([id, , n]) => id === 'want' || (n as number) > 0) as [typeof tab, string, number][]
	);
</script>

<svelte:head>
	<title>{data.listName} · Watchlist</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<header class="border-b">
	<div class="mx-auto max-w-6xl px-4 pt-6 sm:px-8">
		<a href="/" class="text-xl text-muted-foreground"><Wordmark /></a>
		<p class="label mt-6">{data.ownerName}’s list</p>
		<h1 class="display mt-1 text-4xl sm:text-6xl">{data.listName}</h1>
		<nav class="mt-6 flex gap-6" aria-label="Sections">
			{#each tabs as [id, label, n] (id)}
				<button
					onclick={() => (tab = id)}
					aria-current={tab === id ? 'page' : undefined}
					class="-mb-px border-b-2 py-2.5 text-sm transition-colors duration-150 {tab === id
						? 'border-primary font-medium'
						: 'border-transparent text-muted-foreground hover:text-foreground'}"
				>
					{label} <span class="figures text-muted-foreground">{n}</span>
				</button>
			{/each}
		</nav>
	</div>
</header>

<main class="mx-auto max-w-6xl px-4 py-8 sm:px-8">
	{#key tab}
		<ItemBrowser
			items={tab === 'want' ? data.want : tab === 'soon' ? data.soon : data.watched}
			view={data.view}
			readonly
			showServicesFilter={false}
			sorts={tab === 'watched'
				? ['watched', 'rating', 'title']
				: tab === 'soon'
					? ['release', 'title']
					: ['mentions', 'added', 'title', 'short']}
		>
			{#snippet empty()}
				<p class="py-10 text-muted-foreground">Nothing here yet.</p>
			{/snippet}
		</ItemBrowser>
	{/key}
</main>

<footer class="border-t">
	<p class="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-8">
		A read-only list shared from Watchlist. {plural(data.want.length, 'title')} still to watch.
		{#if data.tmdbEnabled}Film data from TMDB. This product uses the TMDB API but is not endorsed or
			certified by TMDB. Streaming data from JustWatch.{/if}
	</p>
</footer>
