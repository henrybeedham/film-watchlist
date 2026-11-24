<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { kindLabel, poster } from '#lib/format.js';
	import type { TmdbSearchResult } from '#lib/types.js';

	let { open = $bindable(false), initial }: { open?: boolean; initial: string } = $props();

	let query = $state('');
	let results = $state<TmdbSearchResult[]>([]);
	let loading = $state(false);
	let searched = $state(false);

	// Fill in and search when the dialog opens. run() reads `query`, so untrack it: otherwise
	// every keystroke re-runs this and puts the original title back.
	$effect(() => {
		if (!open) return;
		const start = initial;
		untrack(() => {
			query = start;
			void run();
		});
	});

	async function run() {
		const q = query.trim();
		if (q.length < 2) return;
		loading = true;
		try {
			const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}`);
			results = res.ok ? ((await res.json()) as TmdbSearchResult[]) : [];
		} finally {
			loading = false;
			searched = true;
		}
	}

	const done =
		() =>
		async ({ result, update }: { result: { type: string }; update: () => Promise<void> }) => {
			if (result.type === 'success') {
				open = false;
				toast.success('Match updated.');
			}
			await update();
		};
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<p class="label">Change match</p>
			<Dialog.Title>Which one did you mean?</Dialog.Title>
		</Dialog.Header>
		<form
			class="flex gap-2"
			onsubmit={(e) => {
				e.preventDefault();
				void run();
			}}
		>
			<Input bind:value={query} aria-label="Search TMDB" />
			<Button type="submit" variant="outline" disabled={loading}>Search</Button>
		</form>
		<ul class="-mx-2 max-h-[50dvh] overflow-y-auto">
			{#each results as r (r.mediaType + r.tmdbId)}
				{@const src = poster(r.posterPath, 'w92')}
				<li>
					<form method="POST" action="?/rematch" use:enhance={done}>
						<input type="hidden" name="mediaType" value={r.mediaType} />
						<input type="hidden" name="tmdbId" value={r.tmdbId} />
						<button
							class="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left hover:bg-accent"
						>
							<span class="h-[4.5rem] w-12 shrink-0 overflow-hidden rounded-sm bg-muted">
								{#if src}<img {src} alt="" class="size-full object-cover" loading="lazy" />{/if}
							</span>
							<span class="min-w-0">
								<span class="block font-medium">{r.title}</span>
								<span class="figures text-xs text-muted-foreground">
									{[r.year, kindLabel(r.mediaType)].filter(Boolean).join(' · ')}
								</span>
								{#if r.overview}
									<span class="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.overview}</span>
								{/if}
							</span>
						</button>
					</form>
				</li>
			{:else}
				{#if searched && !loading}
					<li class="px-2 py-4 text-muted-foreground">
						No results. Try a different spelling or the original title.
					</li>
				{/if}
			{/each}
		</ul>
		<form method="POST" action="?/rematch" use:enhance={done} class="border-t pt-4">
			<input type="hidden" name="none" value="1" />
			<button
				class="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
			>
				It isn’t on TMDB: keep it as typed
			</button>
		</form>
	</Dialog.Content>
</Dialog.Root>
