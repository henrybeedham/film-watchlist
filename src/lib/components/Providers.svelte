<script lang="ts">
	import { logo } from '#lib/format.js';
	import type { Provider } from '#lib/types.js';

	let {
		providers,
		mine = [],
		max = 4,
		size = 'sm'
	}: { providers: Provider[]; mine?: string[]; max?: number; size?: 'sm' | 'md' } = $props();

	// Services the person has come first.
	const sorted = $derived(
		[...providers].sort((a, b) => Number(mine.includes(b.name)) - Number(mine.includes(a.name)))
	);
	const shown = $derived(sorted.slice(0, max));
	const dim = $derived(size === 'sm' ? 'size-6' : 'size-9');
</script>

{#if providers.length}
	<span class="inline-flex items-center gap-1">
		{#each shown as p (p.id)}
			{@const src = logo(p.logo)}
			<span
				title={p.name + (mine.includes(p.name) ? ' (you have this)' : '')}
				class="relative {dim} shrink-0 overflow-hidden rounded-[22%] {mine.length &&
				!mine.includes(p.name)
					? 'opacity-40 grayscale'
					: ''}"
			>
				{#if src}
					<img {src} alt={p.name} class="size-full object-cover" loading="lazy" />
				{:else}
					<span class="grid size-full place-items-center bg-muted text-[0.5rem]">
						{p.name.slice(0, 2)}
					</span>
				{/if}
			</span>
		{/each}
		{#if sorted.length > max}
			<span class="figures text-xs text-muted-foreground">+{sorted.length - max}</span>
		{/if}
	</span>
{/if}
