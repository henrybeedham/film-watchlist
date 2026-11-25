<script lang="ts">
	import { page } from '$app/state';
	import Search from '@lucide/svelte/icons/search';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import MagnetResults from '#lib/components/MagnetResults.svelte';

	const q = $derived(page.url.searchParams.get('q')?.trim() ?? '');
	const type = $derived(page.url.searchParams.get('type') === 'tv' ? 'tv' : 'movie');
	const src = $derived(
		q.length >= 2 ? `/api/magnets?${new URLSearchParams({ q, type }).toString()}` : null
	);
	let loading = $state(false);
</script>

<svelte:head><title>Find a magnet · Watchlist</title></svelte:head>

<div class="mb-6">
	<p class="label">Any film or series</p>
	<h1 class="display mt-1 text-4xl sm:text-5xl">Find a magnet</h1>
	<p class="mt-2 max-w-xl text-muted-foreground">
		For something that isn’t on a list. Add the year to a film, as in “Dune 2021”, to put that
		release first.
	</p>
</div>

<form method="GET" class="mb-8 flex max-w-2xl flex-wrap gap-2">
	<Input
		name="q"
		value={q}
		placeholder="Title"
		aria-label="Title"
		class="min-w-0 flex-1 basis-52"
		required
		minlength={2}
	/>
	<select
		name="type"
		aria-label="Film or series"
		class="h-9 rounded-md border border-input bg-card px-2 text-sm"
	>
		<option value="movie" selected={type === 'movie'}>Film</option>
		<option value="tv" selected={type === 'tv'}>Series</option>
	</select>
	<Button type="submit" disabled={loading}>
		<Search class="size-4" strokeWidth={1.5} />{loading ? 'Searching…' : 'Search'}
	</Button>
</form>

<MagnetResults {src} bind:loading />
