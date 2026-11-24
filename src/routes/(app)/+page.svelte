<script lang="ts">
	import { page } from '$app/state';
	import { invalidate } from '$app/navigation';
	import { Button } from '#lib/components/ui/button/index.js';
	import QuickAdd from '#lib/components/QuickAdd.svelte';
	import ItemBrowser from '#lib/components/ItemBrowser.svelte';
	import { plural } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// While TMDB lookups run in the background, refresh every few seconds.
	$effect(() => {
		if (!data.tmdbEnabled || data.pending === 0) return;
		const timer = setInterval(() => void invalidate('app:items'), 3000);
		return () => clearInterval(timer);
	});

	const films = $derived(data.items.filter((i) => i.mediaType === 'movie').length);
	const series = $derived(data.items.filter((i) => i.mediaType === 'tv').length);
</script>

<svelte:head><title>To watch · Watchlist</title></svelte:head>

{#if !data.currentList}
	<section class="max-w-lg py-10">
		<h1 class="display text-4xl">No list yet</h1>
		<p class="mt-3 text-muted-foreground">Create a list to start adding films and series.</p>
		<Button href="/lists" class="mt-6">Create a list</Button>
	</section>
{:else}
	<div class="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
		<div>
			<p class="label">{data.currentList.name}</p>
			<h1 class="display mt-1 text-4xl sm:text-5xl">To watch</h1>
		</div>
		<p class="figures text-sm text-muted-foreground">
			{plural(data.items.length, 'title')}{#if films || series}: {plural(films, 'film')}, {series} series{/if}
			{#if data.soonCount}· <a
					href="/coming-soon"
					class="underline underline-offset-4 hover:text-foreground"
				>
					{data.soonCount} coming soon
				</a>{/if}
		</p>
	</div>

	<div class="mb-8 max-w-2xl">
		<QuickAdd tmdbEnabled={data.tmdbEnabled} autofocus={page.url.searchParams.has('add')} />
		{#if data.pending && data.tmdbEnabled}
			<p class="mt-2 text-sm text-muted-foreground" aria-live="polite">
				Looking up posters and details for {plural(data.pending, 'title')}…
			</p>
		{/if}
	</div>

	<ItemBrowser
		items={data.items}
		view={data.view}
		services={data.services}
		pendingLabel={data.tmdbEnabled}
	>
		{#snippet empty()}
			<section class="max-w-lg border-t py-10">
				<h2 class="display text-2xl">Nothing on the list</h2>
				<p class="mt-2 text-muted-foreground">
					Type a title in the box above to add it. Pick a suggestion to get the right one.
				</p>
			</section>
		{/snippet}
	</ItemBrowser>
{/if}
