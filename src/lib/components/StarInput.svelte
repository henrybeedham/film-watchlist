<script lang="ts">
	// Half-star rating stored as 1–10. Click the left half of a star for a half.
	let {
		name = 'rating',
		value = $bindable<number | null>(null)
	}: { name?: string; value?: number | null } = $props();

	let hover = $state<number | null>(null);
	const shown = $derived(hover ?? value ?? 0);

	const label = (n: number) =>
		`${Math.floor(n / 2) || ''}${n % 2 ? '½' : ''} star${n === 2 ? '' : 's'}`;
	const STAR = 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z';
</script>

<div class="flex items-center gap-3">
	<input type="hidden" {name} value={value ?? ''} />
	<div
		class="flex"
		role="radiogroup"
		aria-label="Rating"
		tabindex="-1"
		onmouseleave={() => (hover = null)}
	>
		{#each [1, 2, 3, 4, 5] as star (star)}
			{@const fill = Math.max(0, Math.min(1, (shown - (star - 1) * 2) / 2))}
			<span class="relative size-8">
				<svg viewBox="0 0 24 24" class="absolute inset-0 size-8 text-border" aria-hidden="true">
					<path fill="currentColor" d={STAR} />
				</svg>
				<svg
					viewBox="0 0 24 24"
					class="absolute inset-0 size-8 text-highlight"
					style="clip-path: inset(0 {100 - fill * 100}% 0 0)"
					aria-hidden="true"
				>
					<path fill="currentColor" d={STAR} />
				</svg>
				{#each [star * 2 - 1, star * 2] as n (n)}
					<button
						type="button"
						role="radio"
						aria-checked={value === n}
						aria-label={label(n)}
						class="absolute inset-y-0 w-1/2 {n % 2 ? 'left-0' : 'right-0'}"
						onmouseenter={() => (hover = n)}
						onfocus={() => (hover = n)}
						onblur={() => (hover = null)}
						onclick={() => (value = value === n ? null : n)}
					></button>
				{/each}
			</span>
		{/each}
	</div>
	<span class="figures min-w-16 text-sm text-muted-foreground">
		{shown ? label(shown) : 'No rating'}
	</span>
</div>
