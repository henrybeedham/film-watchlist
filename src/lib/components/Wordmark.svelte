<script lang="ts">
	import { cn } from '#lib/utils.js';

	let { class: className = '' }: { class?: string } = $props();
</script>

<span class={cn('inline-flex items-baseline gap-2', className)}>
	<svg
		viewBox="0 0 32 32"
		class="size-[0.8em] shrink-0 self-center text-highlight"
		aria-hidden="true"
	>
		<!-- Two overlapping admit-one tickets -->
		<path
			fill="currentColor"
			d="M4 9h17v3.2a2.3 2.3 0 0 0 0 4.6V20H4v-3.2a2.3 2.3 0 0 0 0-4.6Z"
			opacity=".55"
		/>
		<path
			fill="currentColor"
			d="M11 13h17v3.2a2.3 2.3 0 0 0 0 4.6V24H11v-3.2a2.3 2.3 0 0 0 0-4.6Z"
		/>
	</svg>
	<span class="display">Watchlist</span>
</span>
