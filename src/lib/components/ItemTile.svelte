<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Poster from './Poster.svelte';
	import { kindLabel, shortDate, year } from '#lib/format.js';
	import type { Item } from '#lib/types.js';

	let {
		item,
		services = [],
		onTick,
		readonly = false,
		eager = false
	}: {
		item: Item;
		services?: string[];
		onTick?: (item: Item) => void;
		readonly?: boolean;
		eager?: boolean;
	} = $props();

	const d = $derived(item.details);
	const y = $derived(year(item.releaseDate) ?? item.yearHint);
	const onMine = $derived(
		!!services.length && !!d?.providers?.stream.some((p) => services.includes(p.name))
	);
</script>

<li class="group offscreen-lazy-tile">
	<div class="relative">
		<svelte:element
			this={readonly ? 'div' : 'a'}
			href={readonly ? undefined : `/item/${item.id}`}
			tabindex="-1"
			aria-hidden="true"
			class="block"
		>
			<Poster path={d?.posterPath} title={item.displayTitle} size="w342" {eager} class="w-full" />
		</svelte:element>
		{#if item.mentions > 1}
			<span
				class="figures pointer-events-none absolute top-1.5 left-1.5 bg-highlight px-1.5 py-0.5 text-xs font-semibold text-highlight-foreground"
				title="Suggested {item.mentions} times"
			>
				×{item.mentions}
			</span>
		{/if}
		{#if onMine && item.status === 'want'}
			<span
				class="pointer-events-none absolute top-1.5 right-1.5 bg-background/90 px-1.5 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase"
			>
				Streaming
			</span>
		{/if}
		{#if item.status === 'want' && !readonly}
			<button
				class="absolute right-1.5 bottom-1.5 grid size-9 place-items-center rounded-full bg-background/95 text-foreground transition-opacity duration-150 hover:bg-primary hover:text-primary-foreground sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
				aria-label="Mark {item.displayTitle} as watched"
				onclick={() => onTick?.(item)}
			>
				<Check class="size-4" strokeWidth={1.75} />
			</button>
		{/if}
	</div>
	<svelte:element
		this={readonly ? 'div' : 'a'}
		href={readonly ? undefined : `/item/${item.id}`}
		class="mt-2 block pr-1"
	>
		<p class="display line-clamp-2 text-[1.05rem] leading-tight screening:text-[1.25rem]">
			{item.displayTitle}
		</p>
		<p class="figures mt-0.5 text-xs text-muted-foreground">
			{[y, kindLabel(item.mediaType)].filter(Boolean).join(' · ')}
			{#if item.comingSoon && item.releaseDate}· Out {shortDate(item.releaseDate)}{/if}
		</p>
	</svelte:element>
</li>
