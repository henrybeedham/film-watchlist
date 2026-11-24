<script lang="ts">
	import Shuffle from '@lucide/svelte/icons/shuffle';
	import { Button } from '#lib/components/ui/button/index.js';
	import Poster from '#lib/components/Poster.svelte';
	import Providers from '#lib/components/Providers.svelte';
	import WatchedDialog from '#lib/components/WatchedDialog.svelte';
	import { kindLabel, plural, runtime, year } from '#lib/format.js';
	import type { Item } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let kind = $state<'any' | 'movie' | 'tv'>('any');
	let maxRuntime = $state(0);
	let genre = $state('');
	let onMine = $state(false);
	let favourSuggested = $state(true);

	let pickId = $state<number | null>(null);
	let recent = $state<number[]>([]);
	let watchedOpen = $state(false);

	const genres = $derived(
		[...new Set(data.items.flatMap((i) => i.details?.genres ?? []))].sort((a, b) =>
			a.localeCompare(b)
		)
	);

	const pool = $derived(
		data.items.filter((i) => {
			if (kind !== 'any' && i.mediaType !== kind) return false;
			if (maxRuntime && (!i.details?.runtime || i.details.runtime > maxRuntime)) return false;
			if (genre && !i.details?.genres.includes(genre)) return false;
			if (onMine && !i.details?.providers?.stream.some((p) => data.services.includes(p.name)))
				return false;
			return true;
		})
	);

	const pick = $derived(data.items.find((i) => i.id === pickId) ?? null);

	function draw() {
		// Avoid repeating the last few picks when there's enough to choose from.
		const fresh = pool.filter((i) => !recent.includes(i.id));
		const from = fresh.length ? fresh : pool;
		if (!from.length) {
			pickId = null;
			return;
		}
		const weight = (i: Item) => (favourSuggested ? i.mentions : 1);
		let r = Math.random() * from.reduce((s, i) => s + weight(i), 0);
		let chosen = from[0];
		for (const i of from) {
			r -= weight(i);
			if (r <= 0) {
				chosen = i;
				break;
			}
		}
		pickId = chosen.id;
		recent = [chosen.id, ...recent].slice(0, Math.min(5, Math.floor(pool.length / 2)));
	}

	const select = 'h-9 rounded-md border border-input bg-card px-2 text-sm';
</script>

<svelte:head><title>Tonight · Watchlist</title></svelte:head>

<div class="mb-6">
	<p class="label">{data.currentList?.name}</p>
	<h1 class="display mt-1 text-4xl sm:text-5xl">What’s on tonight?</h1>
</div>

{#if data.items.length === 0}
	<p class="max-w-lg border-t py-10 text-muted-foreground">
		The list is empty, so there’s nothing to pick from. Add a few titles first.
	</p>
{:else}
	<div class="flex flex-wrap items-center gap-2">
		<label>
			<span class="sr-only">Type</span>
			<select bind:value={kind} class={select}>
				<option value="any">Film or series</option>
				<option value="movie">A film</option>
				<option value="tv">A series</option>
			</select>
		</label>
		<label>
			<span class="sr-only">Length</span>
			<select bind:value={maxRuntime} class={select}>
				<option value={0}>Any length</option>
				<option value={45}>Under 45 minutes</option>
				<option value={95}>Under 1 h 35 min</option>
				<option value={120}>Under 2 hours</option>
			</select>
		</label>
		{#if genres.length}
			<label>
				<span class="sr-only">Genre</span>
				<select bind:value={genre} class={select}>
					<option value="">Any genre</option>
					{#each genres as g (g)}<option value={g}>{g}</option>{/each}
				</select>
			</label>
		{/if}
		{#if data.services.length}
			<label
				class="flex h-9 items-center gap-2 rounded-md border border-input bg-card px-2.5 text-sm"
			>
				<input type="checkbox" bind:checked={onMine} class="accent-[var(--primary)]" /> On my services
			</label>
		{/if}
		<label
			class="flex h-9 items-center gap-2 rounded-md border border-input bg-card px-2.5 text-sm"
			title="Titles suggested more often come up more"
		>
			<input type="checkbox" bind:checked={favourSuggested} class="accent-[var(--primary)]" /> Favour
			×2, ×3
		</label>
	</div>

	<div class="mt-5 flex flex-wrap items-center gap-4">
		<Button size="lg" onclick={draw} disabled={pool.length === 0}>
			<Shuffle class="size-4" strokeWidth={1.5} />
			{pick ? 'Pick another' : 'Pick something'}
		</Button>
		<span class="figures text-sm text-muted-foreground">
			{pool.length ? `From ${plural(pool.length, 'title')}` : 'Nothing fits those filters.'}
		</span>
	</div>

	{#if pick}
		{@const d = pick.details}
		<section
			class="mt-10 grid gap-6 border-t pt-8 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-10"
			aria-live="polite"
		>
			<a href="/item/{pick.id}" class="w-40 sm:w-full" tabindex="-1" aria-hidden="true">
				<Poster
					path={d?.posterPath}
					title={pick.displayTitle}
					size="w500"
					placeholder={data.view === 'grid' ? 'w342' : 'w185'}
					class="w-full"
				/>
			</a>
			<div class="min-w-0">
				<p class="label">Tonight’s feature</p>
				<h2 class="display mt-2 text-4xl [overflow-wrap:anywhere] sm:text-6xl">
					<a
						href="/item/{pick.id}"
						class="hover:underline hover:decoration-1 hover:underline-offset-8"
					>
						{pick.displayTitle}
					</a>
				</h2>
				<p class="figures mt-3 text-muted-foreground">
					{[
						year(pick.releaseDate) ?? pick.yearHint,
						kindLabel(pick.mediaType),
						runtime(d?.runtime),
						d?.genres.slice(0, 3).join(', ')
					]
						.filter(Boolean)
						.join(' · ')}
				</p>
				{#if pick.mentions > 1 || pick.recommendedBy}
					<p class="mt-2 text-sm">
						{pick.mentions > 1 ? `Suggested ${pick.mentions} times` : ''}{pick.mentions > 1 &&
						pick.recommendedBy
							? ', '
							: ''}{pick.recommendedBy
							? `${pick.mentions > 1 ? 'f' : 'F'}rom ${pick.recommendedBy}`
							: ''}.
					</p>
				{/if}
				{#if d?.overview}
					<p class="mt-4 max-w-2xl leading-relaxed">{d.overview}</p>
				{/if}
				{#if d?.providers?.stream.length}
					<div class="mt-5 flex items-center gap-3">
						<span class="text-sm text-muted-foreground">Streaming on</span>
						<Providers providers={d.providers.stream} mine={data.services} max={6} size="md" />
					</div>
				{/if}
				<div class="mt-6 flex flex-wrap gap-2">
					<Button variant="outline" onclick={() => (watchedOpen = true)}>We watched it</Button>
					<Button variant="ghost" href="/item/{pick.id}">More about it</Button>
				</div>
			</div>
		</section>
		<WatchedDialog bind:open={watchedOpen} item={pick} />
	{/if}
{/if}
