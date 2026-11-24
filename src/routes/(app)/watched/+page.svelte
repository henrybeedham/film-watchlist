<script lang="ts">
	import ItemBrowser from '#lib/components/ItemBrowser.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { plural } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>Watched · Watchlist</title></svelte:head>

<div class="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
	<div>
		<p class="label">{data.currentList?.name}</p>
		<h1 class="display mt-1 text-4xl sm:text-5xl">Watched</h1>
	</div>
	{#if data.items.length}
		<p class="figures text-sm text-muted-foreground">
			{plural(data.items.length, 'title')} ticked off{#if data.thisYear}, {data.thisYear} logged by you
				this year{/if}
		</p>
	{/if}
</div>

<ItemBrowser
	items={data.items}
	view={data.view}
	sorts={['watched', 'rating', 'title']}
	showServicesFilter={false}
>
	{#snippet empty()}
		<section class="max-w-lg border-t py-10">
			<p class="text-muted-foreground">
				Nothing watched yet. Tick something off from To watch and it moves here, with your rating
				and notes.
			</p>
			<Button href="/import" variant="outline" class="mt-5">Import from Letterboxd</Button>
		</section>
	{/snippet}
</ItemBrowser>
