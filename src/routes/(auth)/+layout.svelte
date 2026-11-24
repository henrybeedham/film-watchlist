<script lang="ts">
	import Wordmark from '#lib/components/Wordmark.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<div
	class="mx-auto grid min-h-dvh max-w-5xl gap-10 px-4 py-10 sm:px-8 md:grid-cols-[1fr_minmax(0,24rem)] md:items-center md:gap-16"
>
	<header class="max-w-md">
		<p class="label mb-4">Now showing, eventually</p>
		<Wordmark class="text-5xl sm:text-6xl" />
		<p class="mt-5 text-lg leading-relaxed text-muted-foreground">
			The films and series people keep telling you to watch, in one place — with posters, where to
			stream them in the UK, and something to pick when you can’t decide.
		</p>
	</header>
	<main>
		{@render children()}
	</main>
</div>
