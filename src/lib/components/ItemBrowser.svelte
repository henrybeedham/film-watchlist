<script lang="ts" module>
	export type SortKey = 'mentions' | 'added' | 'title' | 'short' | 'release' | 'watched' | 'rating';
	export const SORT_LABELS: Record<SortKey, string> = {
		mentions: 'Most suggested',
		added: 'Recently added',
		title: 'A to Z',
		short: 'Shortest first',
		release: 'Release date',
		watched: 'Recently watched',
		rating: 'Highest rated'
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import { snapshot } from '$app/navigation';
	import Rows from '@lucide/svelte/icons/rows-3';
	import Grid from '@lucide/svelte/icons/layout-grid';
	import Search from '@lucide/svelte/icons/search';
	import ItemRow from './ItemRow.svelte';
	import ItemTile from './ItemTile.svelte';
	import WatchedDialog from './WatchedDialog.svelte';
	import { titleKey } from '#lib/notes-parser.js';
	import type { Item } from '#lib/types.js';
	import type { View } from '#lib/themes.js';

	let {
		items,
		view,
		services = [],
		sorts = ['mentions', 'added', 'title', 'short'],
		readonly = false,
		pendingLabel = false,
		showServicesFilter = true,
		empty
	}: {
		items: Item[];
		view: View;
		services?: string[];
		sorts?: SortKey[];
		readonly?: boolean;
		pendingLabel?: boolean;
		showServicesFilter?: boolean;
		empty?: Snippet;
	} = $props();

	let q = $state('');
	let kind = $state<'all' | 'movie' | 'tv'>('all');
	let genre = $state('');
	let onMine = $state(false);
	let sortChoice = $state<SortKey | null>(null);
	const sort = $derived(sortChoice ?? sorts[0]);
	let viewChoice = $state<View | null>(null);
	const currentView = $derived(viewChoice ?? view);

	// Keep the search, filters and sort when going back to this page from a title.
	interface Filters {
		q: string;
		kind: typeof kind;
		genre: string;
		onMine: boolean;
		sortChoice: SortKey | null;
		viewChoice: View | null;
	}
	const setFilters = (f: Filters) => ({ q, kind, genre, onMine, sortChoice, viewChoice } = f);
	snapshot<Filters>({
		id: 'item-browser',
		capture: () => ({ q, kind, genre, onMine, sortChoice, viewChoice }),
		restore: setFilters,
		reset: () =>
			setFilters({
				q: '',
				kind: 'all',
				genre: '',
				onMine: false,
				sortChoice: null,
				viewChoice: null
			})
	});

	let ticking = $state<Item | null>(null);
	let dialogOpen = $state(false);
	function tick(item: Item) {
		ticking = item;
		dialogOpen = true;
	}

	const genres = $derived(
		[...new Set(items.flatMap((i) => i.details?.genres ?? []))].sort((a, b) => a.localeCompare(b))
	);

	const topRating = (i: Item) => Math.max(0, ...i.diary.map((e) => e.rating ?? 0));
	const lastWatched = (i: Item) => i.diary[0]?.watchedOn ?? i.watchedAt ?? '';

	const shown = $derived.by(() => {
		const needle = titleKey(q);
		const list = items.filter((i) => {
			if (kind !== 'all' && i.mediaType !== kind) return false;
			if (genre && !i.details?.genres.includes(genre)) return false;
			if (onMine && !i.details?.providers?.stream.some((p) => services.includes(p.name)))
				return false;
			if (
				needle &&
				!titleKey(i.displayTitle).includes(needle) &&
				!titleKey(i.title).includes(needle)
			)
				return false;
			return true;
		});
		const by: Record<SortKey, (a: Item, b: Item) => number> = {
			mentions: (a, b) => b.mentions - a.mentions || b.createdAt.localeCompare(a.createdAt),
			added: (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id,
			title: (a, b) =>
				a.displayTitle.localeCompare(b.displayTitle, 'en-GB', { ignorePunctuation: true }),
			short: (a, b) => (a.details?.runtime ?? 999) - (b.details?.runtime ?? 999),
			release: (a, b) => (a.releaseDate ?? '9999').localeCompare(b.releaseDate ?? '9999'),
			watched: (a, b) => lastWatched(b).localeCompare(lastWatched(a)),
			rating: (a, b) => topRating(b) - topRating(a)
		};
		return list.sort(by[sort]);
	});

	const filtered = $derived(q || kind !== 'all' || genre || onMine);
	const select =
		'h-9 rounded-md border border-input bg-card px-2 text-sm text-foreground focus-visible:border-ring';
</script>

{#if items.length === 0}
	{@render empty?.()}
{:else}
	<div class="mb-4 flex flex-wrap items-center gap-2">
		<label class="relative min-w-0 flex-[1_1_12rem]">
			<span class="sr-only">Search this list</span>
			<Search
				class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
				strokeWidth={1.5}
			/>
			<input
				type="search"
				bind:value={q}
				placeholder="Search"
				class="h-9 w-full rounded-md border border-input bg-card pr-2 pl-8 text-sm placeholder:text-muted-foreground focus-visible:border-ring"
			/>
		</label>
		<div
			class="flex rounded-md border border-input bg-card p-0.5 text-sm"
			role="group"
			aria-label="Type"
		>
			{#each [['all', 'All'], ['movie', 'Films'], ['tv', 'Series']] as [value, label] (value)}
				<button
					type="button"
					aria-pressed={kind === value}
					onclick={() => (kind = value as typeof kind)}
					class="rounded-[calc(var(--radius)*0.6)] px-2.5 py-1 transition-colors duration-150 {kind ===
					value
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					{label}
				</button>
			{/each}
		</div>
		{#if genres.length}
			<label>
				<span class="sr-only">Genre</span>
				<select bind:value={genre} class={select}>
					<option value="">Any genre</option>
					{#each genres as g (g)}<option value={g}>{g}</option>{/each}
				</select>
			</label>
		{/if}
		<label>
			<span class="sr-only">Sort</span>
			<select bind:value={() => sort, (v: SortKey) => (sortChoice = v)} class={select}>
				{#each sorts as s (s)}<option value={s}>{SORT_LABELS[s]}</option>{/each}
			</select>
		</label>
		{#if showServicesFilter && services.length}
			<label
				class="flex h-9 items-center gap-2 rounded-md border border-input bg-card px-2.5 text-sm"
			>
				<input type="checkbox" bind:checked={onMine} class="accent-[var(--primary)]" />
				On my services
			</label>
		{/if}
		<form
			method="POST"
			action="?/view"
			class="ml-auto flex rounded-md border border-input bg-card p-0.5"
			use:enhance={() => async () => {}}
		>
			{#each [['rows', Rows, 'List'], ['grid', Grid, 'Posters']] as const as [value, Icon, label] (value)}
				<button
					name="view"
					{value}
					formaction={readonly ? undefined : '?/view'}
					type={readonly ? 'button' : 'submit'}
					aria-pressed={currentView === value}
					aria-label="Show as {label.toLowerCase()}"
					title={label}
					onclick={() => (viewChoice = value)}
					class="grid size-8 place-items-center rounded-[calc(var(--radius)*0.6)] transition-colors duration-150 {currentView ===
					value
						? 'bg-primary text-primary-foreground'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					<Icon class="size-4" strokeWidth={1.5} />
				</button>
			{/each}
		</form>
	</div>

	{#if filtered}
		<p class="label mb-2">{shown.length} of {items.length}</p>
	{/if}

	{#if shown.length === 0}
		<p class="py-10 text-muted-foreground">Nothing matches those filters.</p>
	{:else if currentView === 'grid'}
		<ul
			class="grid grid-cols-[repeat(auto-fill,minmax(7.25rem,1fr))] gap-x-3 gap-y-5 sm:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] sm:gap-x-4"
		>
			{#each shown as item (item.id)}
				<ItemTile {item} {services} {readonly} onTick={tick} />
			{/each}
		</ul>
	{:else}
		<ul class="border-t programme:border-t-0 screening:border-t-0">
			{#each shown as item, i (item.id)}
				<ItemRow {item} number={i + 1} {services} {readonly} {pendingLabel} onTick={tick} />
			{/each}
		</ul>
	{/if}
{/if}

{#if !readonly}
	<WatchedDialog bind:open={dialogOpen} item={ticking} />
{/if}
