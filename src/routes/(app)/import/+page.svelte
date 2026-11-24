<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { parseNotes, titleKey, type ParsedRow } from '#lib/notes-parser.js';
	import { plural } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Row = ParsedRow & {
		action: 'add' | 'skip' | 'bump';
		existingId: number | null;
		/** Why it's flagged, if it is. */
		flag: string | null;
	};

	const PLACEHOLDER =
		'Film\n- [ ] The usual suspects\n- [ ] Vivarium x3\n- [ ] Prison break (Hugh recommendation)\n- [x] Whiplash';

	let text = $state('');
	let step = $state<'paste' | 'review'>('paste');
	let rows = $state<Row[]>([]);
	let heading = $state<string | null>(null);
	let busy = $state(false);

	const preview = $derived(parseNotes(text));

	function review() {
		// Plain maps: only used inside this function, never rendered.
		const existing = new Map(data.existing.map((e) => [e.key, e]));
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const seen = new Map<string, ParsedRow>();
		heading = preview.heading;
		rows = preview.rows.map((r) => {
			const key = titleKey(r.title);
			const onList = existing.get(key);
			const earlier = seen.get(key);
			if (!earlier) seen.set(key, r);
			if (onList) {
				return {
					...r,
					action: 'skip',
					existingId: onList.id,
					flag: `Already on the list as “${onList.title}”`
				};
			}
			// Same title twice in the note. Different years mean different films.
			if (earlier && !(earlier.yearHint && r.yearHint && earlier.yearHint !== r.yearHint)) {
				return {
					...r,
					action: 'skip',
					existingId: null,
					flag: `Looks like a repeat of “${earlier.title}” on line ${earlier.line}`
				};
			}
			return { ...r, action: 'add', existingId: null, flag: null };
		});
		step = 'review';
		window.scrollTo({ top: 0 });
	}

	const adding = $derived(rows.filter((r) => r.action === 'add'));
	const bumping = $derived(rows.filter((r) => r.action === 'bump'));
	const watchedCount = $derived(adding.filter((r) => r.watched).length);
</script>

<svelte:head><title>Import · Watchlist</title></svelte:head>

<div class="mb-6">
	<p class="label">Into {data.currentList?.name}</p>
	<h1 class="display mt-1 text-4xl sm:text-5xl">Import from Apple Notes</h1>
</div>

{#if step === 'paste'}
	<div class="grid gap-8 lg:grid-cols-[1fr_20rem]">
		<div class="grid content-start gap-3">
			<label for="notes" class="text-sm font-medium">Paste your note</label>
			<Textarea
				id="notes"
				bind:value={text}
				rows={16}
				class="font-mono text-sm leading-relaxed"
				placeholder={PLACEHOLDER}
			/>
			<div class="flex flex-wrap items-center gap-3">
				<Button onclick={review} disabled={preview.rows.length === 0}>
					Review {preview.rows.length ? plural(preview.rows.length, 'title') : ''}
				</Button>
				{#if preview.rows.length}
					<span class="figures text-sm text-muted-foreground">
						{preview.rows.filter((r) => r.watched).length} ticked off
					</span>
				{/if}
			</div>
		</div>
		<aside class="text-sm leading-relaxed text-muted-foreground">
			<h2 class="label mb-2">How to copy it</h2>
			<p>
				Open the note, select everything (⌘A on a Mac; on iPhone, tap and hold, then Select All),
				copy, and paste it here.
			</p>
			<h2 class="label mt-6 mb-2">What it understands</h2>
			<ul class="grid gap-1.5">
				<li>Ticked items come in as watched.</li>
				<li>
					<span class="font-mono text-foreground">x2</span>,
					<span class="font-mono text-foreground">x3</span> become how many times it was suggested.
				</li>
				<li>
					<span class="font-mono text-foreground">(2022)</span> or a trailing year helps find the right
					one.
				</li>
				<li>
					<span class="font-mono text-foreground">(Hugh recommendation)</span> records who suggested it.
				</li>
				<li>Anything after “ - ” is kept as a note, and ⬆️ becomes the title above.</li>
			</ul>
			<p class="mt-4">You can check everything before it’s saved.</p>
		</aside>
	</div>
{:else}
	<form
		method="POST"
		action="?/commit"
		use:enhance={() => {
			busy = true;
			return async ({ result, update }) => {
				busy = false;
				if (result.type === 'success') {
					const d = result.data as { added: number; bumped: number };
					toast.success(
						`Imported ${plural(d.added, 'title')}${d.bumped ? `, and added mentions to ${d.bumped} already on the list` : ''}.`
					);
					await goto(watchedCount === adding.length ? '/watched' : '/', { invalidateAll: true });
				} else await update();
			};
		}}
	>
		<input type="hidden" name="rows" value={JSON.stringify(rows)} />
		<div
			class="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-3 sm:-mx-8 sm:px-8"
		>
			<p class="figures mr-auto text-sm">
				Adding <strong>{adding.length}</strong>{#if watchedCount}, {watchedCount} as watched{/if}{#if bumping.length};
					{bumping.length} extra mentions{/if}
				{#if heading}<span class="text-muted-foreground"> from “{heading}”</span>{/if}
			</p>
			<Button variant="ghost" onclick={() => (step = 'paste')}>Back</Button>
			<Button type="submit" disabled={busy || adding.length + bumping.length === 0}>
				{busy ? 'Importing…' : 'Import'}
			</Button>
		</div>

		<ul class="divide-y border-y">
			{#each rows as row, i (row.line)}
				<li
					class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 py-2.5 {row.action === 'skip'
						? 'opacity-60'
						: ''}"
				>
					<input
						type="checkbox"
						aria-label="Import {row.title}"
						class="mt-2.5 size-4 accent-[var(--primary)]"
						checked={row.action !== 'skip'}
						onchange={(e) =>
							(rows[i].action = e.currentTarget.checked
								? row.existingId
									? 'bump'
									: 'add'
								: 'skip')}
					/>
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<input
								bind:value={rows[i].title}
								aria-label="Title"
								class="h-9 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 font-medium hover:border-input focus-visible:border-ring"
							/>
							<label class="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
								<input
									type="checkbox"
									bind:checked={rows[i].watched}
									class="accent-[var(--primary)]"
								/>
								Watched
							</label>
						</div>
						<p class="figures px-2 text-xs text-muted-foreground">
							{[
								row.mentions > 1 ? `Suggested ×${row.mentions}` : '',
								row.yearHint ? String(row.yearHint) : '',
								row.kindHint === 'movie' ? 'Film' : row.kindHint === 'tv' ? 'Series' : '',
								row.recommendedBy ? `From ${row.recommendedBy}` : '',
								row.note ?? ''
							]
								.filter(Boolean)
								.join(' · ')}
						</p>
						{#if row.flag}
							<p class="px-2 text-xs font-medium text-foreground">
								{row.flag}.
								{#if row.existingId}
									{row.action === 'bump'
										? 'Will add a mention to it.'
										: 'Tick to add a mention to it.'}
								{:else}
									Tick to import it anyway.
								{/if}
							</p>
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	</form>
{/if}
