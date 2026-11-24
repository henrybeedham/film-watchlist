<script lang="ts">
	import ItemBrowser from '#lib/components/ItemBrowser.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Coming soon · Watchlist</title></svelte:head>

<div class="mb-6">
	<p class="label">{data.currentList?.name}</p>
	<h1 class="display mt-1 text-4xl sm:text-5xl">Coming soon</h1>
	<p class="mt-2 max-w-xl text-muted-foreground">
		Titles that aren’t out yet in the UK. Each one moves to To watch on its release date.
	</p>
</div>

<ItemBrowser
	items={data.items}
	view={data.view}
	services={data.services}
	sorts={['release', 'mentions', 'title']}
	showServicesFilter={false}
>
	{#snippet empty()}
		<p class="max-w-lg border-t py-10 text-muted-foreground">
			Nothing unreleased on this list. When you add something that isn’t out yet, it waits here
			until its release date. You can set a date by hand on any title’s page.
		</p>
	{/snippet}
</ItemBrowser>
