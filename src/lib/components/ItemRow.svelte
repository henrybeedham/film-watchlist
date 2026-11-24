<script lang="ts">
	import { enhance } from '$app/forms';
	import Check from '@lucide/svelte/icons/check';
	import Plus from '@lucide/svelte/icons/plus';
	import Poster from './Poster.svelte';
	import Providers from './Providers.svelte';
	import { kindLabel, longDate, runtime, stars, year } from '#lib/format.js';
	import type { Item } from '#lib/types.js';

	let {
		item,
		number,
		services = [],
		pendingLabel = false,
		onTick,
		readonly = false,
		eager = false
	}: {
		item: Item;
		number: number;
		services?: string[];
		pendingLabel?: boolean;
		onTick?: (item: Item) => void;
		readonly?: boolean;
		eager?: boolean;
	} = $props();

	const d = $derived(item.details);
	const y = $derived(year(item.releaseDate) ?? item.yearHint);
	const meta = $derived(
		[
			y,
			kindLabel(item.mediaType),
			d?.mediaType === 'tv' && d.seasons
				? `${d.seasons} season${d.seasons === 1 ? '' : 's'}`
				: runtime(d?.runtime),
			d?.genres.slice(0, 2).join(', ')
		].filter(Boolean)
	);
	const myRating = $derived(item.diary.find((e) => e.rating)?.rating ?? null);
	const href = $derived(readonly ? undefined : `/item/${item.id}`);
</script>

<li
	class="programme:perforated flex items-center gap-3 py-3 offscreen-lazy
		sm:gap-4
		screening:border-b screening:border-border/60 screening:py-4
		posters:border-b
		catalogue:border-b catalogue:py-2.5"
>
	<span class="figures hidden w-9 shrink-0 font-mono text-xs text-muted-foreground catalogue:block">
		{String(number).padStart(3, '0')}
	</span>

	<svelte:element
		this={href ? 'a' : 'div'}
		{href}
		tabindex="-1"
		aria-hidden="true"
		class="shrink-0"
	>
		<Poster
			path={d?.posterPath}
			title={item.displayTitle}
			size="w185"
			{eager}
			class="w-11 programme:w-11 screening:w-16 sm:screening:w-20 posters:w-12 catalogue:w-9"
		/>
	</svelte:element>

	<div class="min-w-0 flex-1">
		<svelte:element
			this={href ? 'a' : 'span'}
			{href}
			class="display block text-[1.25rem] leading-tight [overflow-wrap:anywhere] hover:underline hover:decoration-1 hover:underline-offset-4
				screening:text-[1.6rem] posters:text-[1.35rem] catalogue:text-[1.15rem]"
		>
			{item.displayTitle}
		</svelte:element>
		<p class="mt-1 flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-muted-foreground">
			{#each meta as m, i (i)}
				{#if i > 0}<span aria-hidden="true" class="text-border">/</span>{/if}
				<span class="figures">{m}</span>
			{/each}
			{#if item.matchStatus === 'pending' && pendingLabel}
				<span class="italic">Looking up details…</span>
			{/if}
			{#if item.comingSoon}
				<span class="font-medium text-highlight brightness-90 dark:brightness-100">
					{item.releaseDate ? `Out ${longDate(item.releaseDate)}` : 'Release date to be announced'}
				</span>
			{/if}
			{#if item.status === 'watched' && myRating}
				<span class="figures text-foreground" title="{stars(myRating)} out of 5">
					★ {stars(myRating)}
				</span>
			{/if}
		</p>
		{#if item.note || item.recommendedBy}
			<p
				class="mt-1 line-clamp-2 text-[0.8125rem] text-muted-foreground italic programme:not-italic"
			>
				{#if item.recommendedBy}<span class="not-italic">
						From {item.recommendedBy}
					</span>{#if item.note}<span aria-hidden="true"> · </span>{/if}{/if}{item.note ?? ''}
			</p>
		{/if}
		{#if d?.providers?.stream.length && item.status === 'want'}
			<div class="mt-2 sm:hidden">
				<Providers providers={d.providers.stream} mine={services} max={5} />
			</div>
		{/if}
	</div>

	{#if d?.providers?.stream.length && item.status === 'want'}
		<div class="hidden w-32 justify-end sm:flex">
			<Providers providers={d.providers.stream} mine={services} max={4} />
		</div>
	{/if}

	{#if item.status === 'want'}
		<div
			class="flex shrink-0 items-center gap-0.5 self-stretch
				programme:border-l programme:border-dashed programme:pl-3"
		>
			{#if item.mentions > 1}
				<span
					class="figures programme:display min-w-7 text-center text-sm text-muted-foreground programme:text-lg programme:text-primary posters:bg-highlight posters:px-1.5 posters:font-semibold posters:text-highlight-foreground"
					title="Suggested {item.mentions} times"
				>
					×{item.mentions}
				</span>
			{/if}
			{#if !readonly}
				<form method="POST" action="?/mention" use:enhance class="contents">
					<input type="hidden" name="itemId" value={item.id} />
					<button
						class="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
						aria-label="Someone else suggested {item.displayTitle}"
						title="Suggested again"
					>
						<Plus class="size-4" strokeWidth={1.5} />
					</button>
				</form>
				<button
					class="grid size-9 place-items-center rounded-full border border-input text-muted-foreground transition-colors duration-150 hover:border-primary hover:bg-primary hover:text-primary-foreground"
					aria-label="Mark {item.displayTitle} as watched"
					title="Watched it"
					onclick={() => onTick?.(item)}
				>
					<Check class="size-4" strokeWidth={1.75} />
				</button>
			{/if}
		</div>
	{/if}
</li>
