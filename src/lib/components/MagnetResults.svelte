<script lang="ts">
	import { toast } from 'svelte-sonner';
	import Copy from '@lucide/svelte/icons/copy';
	import { Button } from '#lib/components/ui/button/index.js';
	import { fileSize } from '#lib/format.js';
	import type { MagnetResult } from '#lib/types.js';

	/** The /api/magnets URL to search with; nothing shows while it’s null. */
	let { src, loading = $bindable(false) }: { src: string | null; loading?: boolean } = $props();

	type State =
		| { state: 'loading' }
		| { state: 'done'; query: string; results: MagnetResult[] }
		| { state: 'error'; message: string };
	let result = $state<State | null>(null);

	$effect(() => {
		const url = src;
		result = url ? { state: 'loading' } : null;
		if (!url) return;
		let current = true;
		loading = true;
		void (async () => {
			let next: State;
			try {
				const res = await fetch(url);
				const body = (await res.json().catch(() => null)) as {
					query?: string;
					results?: MagnetResult[];
					message?: string;
				} | null;
				next =
					res.ok && body?.results
						? { state: 'done', query: body.query ?? '', results: body.results }
						: { state: 'error', message: body?.message ?? 'The search didn’t work. Try again.' };
			} catch {
				next = { state: 'error', message: 'Couldn’t reach the app. Try again.' };
			}
			if (!current) return;
			result = next;
			loading = false;
		})();
		return () => {
			current = false;
			loading = false;
		};
	});

	async function copy(link: string) {
		try {
			await navigator.clipboard.writeText(link);
			toast.success('Magnet link copied.');
		} catch {
			toast.error('Couldn’t copy. Open the link instead.');
		}
	}
</script>

{#if result}
	<section class="max-w-2xl" aria-live="polite">
		<h2 class="label mb-3">Magnet links</h2>
		{#if result.state === 'loading'}
			<p class="text-muted-foreground">Asking the torrent indexes. This can take 20 seconds.</p>
		{:else if result.state === 'error'}
			<p class="text-muted-foreground">{result.message}</p>
		{:else if result.results.length === 0}
			<p class="text-muted-foreground">Nothing found for “{result.query}”.</p>
		{:else}
			<ul class="divide-y border-y">
				{#each result.results as r (r.magnet)}
					<li class="flex items-center gap-3 py-2.5">
						<a href={r.magnet} class="min-w-0 flex-1 transition-colors hover:text-highlight">
							<span class="block text-sm [overflow-wrap:anywhere]">{r.name}</span>
							<span class="figures block text-xs text-muted-foreground">
								{[`${r.seeders} seeders`, fileSize(r.sizeBytes), r.source]
									.filter(Boolean)
									.join(' · ')}
							</span>
						</a>
						<Button
							variant="ghost"
							size="icon"
							aria-label="Copy magnet link"
							onclick={() => copy(r.magnet)}
						>
							<Copy class="size-4" strokeWidth={1.5} />
						</Button>
					</li>
				{/each}
			</ul>
			<p class="mt-2 text-xs text-muted-foreground">
				Searched for “{result.query}”. Click a result to open it in your torrent app.
			</p>
		{/if}
	</section>
{/if}
