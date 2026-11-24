<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import Plus from '@lucide/svelte/icons/plus';
	import { Button } from '#lib/components/ui/button/index.js';
	import { kindLabel, poster } from '#lib/format.js';
	import type { TmdbSearchResult } from '#lib/types.js';

	let { tmdbEnabled, autofocus = false }: { tmdbEnabled: boolean; autofocus?: boolean } = $props();

	let query = $state('');
	let results = $state<TmdbSearchResult[]>([]);
	let picked = $state<TmdbSearchResult | null>(null);
	let open = $state(false);
	let highlighted = $state(-1);
	let input: HTMLInputElement | undefined = $state();
	let form: HTMLFormElement | undefined = $state();
	let force = $state(false);

	$effect(() => {
		if (autofocus) input?.focus();
	});

	// Debounced TMDB suggestions.
	$effect(() => {
		const q = query.trim();
		if (!tmdbEnabled || q.length < 2 || picked) {
			results = [];
			return;
		}
		const ctrl = new AbortController();
		const timer = setTimeout(() => void lookup(), 250);
		async function lookup() {
			try {
				const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}`, {
					signal: ctrl.signal
				});
				if (res.ok) {
					results = ((await res.json()) as TmdbSearchResult[]).slice(0, 6);
					highlighted = -1;
					open = true;
				}
			} catch {
				// typing on; ignore aborted requests
			}
		}
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	});

	function choose(r: TmdbSearchResult) {
		picked = r;
		query = r.title;
		open = false;
		queueMicrotask(() => form?.requestSubmit());
	}

	function onKeydown(e: KeyboardEvent) {
		if (!open || results.length === 0) return;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlighted = (highlighted + 1) % results.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlighted = highlighted <= 0 ? results.length - 1 : highlighted - 1;
		} else if (e.key === 'Enter' && highlighted >= 0) {
			e.preventDefault();
			choose(results[highlighted]);
		} else if (e.key === 'Escape') {
			open = false;
		}
	}
</script>

<form
	method="POST"
	action="?/add"
	bind:this={form}
	class="relative"
	use:enhance={() => {
		open = false;
		return async ({ result, update }) => {
			if (result.type === 'success') {
				const d = result.data as { added?: boolean; bumped?: boolean; title?: string };
				toast.success(
					d.bumped
						? `“${d.title}” was already on the list, so it now has another mention.`
						: `Added “${d.title}”.`
				);
				query = '';
				picked = null;
				force = false;
			} else if (result.type === 'failure' && result.status === 409) {
				const d = result.data as { message: string };
				toast(d.message, {
					action: {
						label: 'Add anyway',
						onClick: () => {
							force = true;
							queueMicrotask(() => form?.requestSubmit());
						}
					}
				});
			}
			await update({ reset: false });
		};
	}}
>
	<input type="hidden" name="mediaType" value={picked?.mediaType ?? ''} />
	<input type="hidden" name="tmdbId" value={picked?.tmdbId ?? ''} />
	<input type="hidden" name="force" value={force ? '1' : ''} />
	<label for="quick-add" class="sr-only">Add a film or series</label>
	<div class="flex items-stretch gap-2">
		<input
			id="quick-add"
			name="title"
			bind:this={input}
			bind:value={query}
			oninput={() => (picked = null)}
			onkeydown={onKeydown}
			onfocus={() => results.length && (open = true)}
			onblur={() => setTimeout(() => (open = false), 150)}
			autocomplete="off"
			enterkeyhint="done"
			role="combobox"
			aria-expanded={open && results.length > 0}
			aria-controls="quick-add-results"
			aria-autocomplete="list"
			placeholder="Add a film or series"
			class="h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none"
		/>
		<Button type="submit" size="lg" class="h-11 shrink-0" aria-label="Add">
			<Plus class="size-4" strokeWidth={1.75} /><span class="hidden sm:inline">Add</span>
		</Button>
	</div>

	{#if open && results.length}
		<ul
			id="quick-add-results"
			role="listbox"
			class="absolute inset-x-0 top-full z-30 mt-1 max-h-96 overflow-auto rounded-md border bg-popover py-1 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.5)]"
		>
			{#each results as r, i (r.mediaType + r.tmdbId)}
				{@const src = poster(r.posterPath, 'w92')}
				<li role="option" aria-selected={i === highlighted}>
					<button
						type="button"
						class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent {i ===
						highlighted
							? 'bg-accent'
							: ''}"
						onmousedown={(e) => e.preventDefault()}
						onclick={() => choose(r)}
					>
						<span class="h-12 w-8 shrink-0 overflow-hidden rounded-sm bg-muted">
							{#if src}<img {src} alt="" class="size-full object-cover" />{/if}
						</span>
						<span class="min-w-0">
							<span class="block truncate font-medium">{r.title}</span>
							<span class="figures text-xs text-muted-foreground">
								{[r.year, kindLabel(r.mediaType)].filter(Boolean).join(' · ')}
							</span>
						</span>
					</button>
				</li>
			{/each}
			<li class="border-t px-3 pt-2 pb-1 text-xs text-muted-foreground">
				Not here? Press Add to save it as typed.
			</li>
		</ul>
	{/if}
</form>
