<script lang="ts">
	import './layout.css';
	import { Toaster } from '#lib/components/ui/sonner/index.js';
	import { THEME_FONTS } from '#lib/fonts.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	// Keep <html> in step when the theme or mode changes without a full reload.
	$effect(() => {
		const root = document.documentElement;
		root.dataset.theme = data.theme;
		root.dataset.mode = data.mode;
		if (data.mode !== 'system') {
			root.classList.toggle('dark', data.mode === 'dark');
			return;
		}
		const q = matchMedia('(prefers-color-scheme: dark)');
		const apply = () => root.classList.toggle('dark', q.matches);
		apply();
		q.addEventListener('change', apply);
		return () => q.removeEventListener('change', apply);
	});
</script>

<svelte:head>
	<title>Watchlist</title>
	{#each THEME_FONTS[data.theme] ?? [] as href (href)}
		<link rel="preload" as="font" type="font/woff2" {href} crossorigin="anonymous" />
	{/each}
</svelte:head>

{@render children()}

<Toaster position="bottom-center" />
