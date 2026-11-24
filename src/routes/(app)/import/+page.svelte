<script lang="ts">
	import { deserialize } from '$app/forms';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import { readExportFiles, type LetterboxdFilm } from '#lib/letterboxd.js';
	import { titleKey } from '#lib/notes-parser.js';
	import { plural, shortDate } from '#lib/format.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Row = LetterboxdFilm & {
		include: boolean;
		existing: { id: number; title: string; status: 'want' | 'watched' } | null;
	};
	type Filter = 'want' | 'watched' | 'existing';
	const FILTERS: [Filter, string][] = [
		['want', 'To watch'],
		['watched', 'Watched'],
		['existing', 'Already on the list']
	];

	let step = $state<'choose' | 'review'>('choose');
	let rows = $state<Row[]>([]);
	let filter = $state<Filter>('want');
	let reading = $state(false);
	let readError = $state<string | null>(null);
	let progress = $state<number | null>(null);

	async function choose(files: FileList | null) {
		if (!files?.length) return;
		reading = true;
		readError = null;
		try {
			const films = await readExportFiles([...files]);
			if (films.length === 0) throw new Error('The export has no films in it.');
			rows = films.map(withExisting);
			filter = rows.some((r) => r.status === 'want' && !r.existing) ? 'want' : 'watched';
			step = 'review';
			window.scrollTo({ top: 0 });
		} catch (e) {
			readError = (e as Error).message || 'Couldn’t read that file.';
		} finally {
			reading = false;
		}
	}

	/** Pairs a film with one already on the list. Remakes share a title, so the year has to agree. */
	function withExisting(f: LetterboxdFilm): Row {
		const key = titleKey(f.title);
		const match = data.existing.find(
			(e) => e.keys.includes(key) && (!e.year || !f.year || Math.abs(e.year - f.year) <= 1)
		);
		const existing = match ? { id: match.id, title: match.title, status: match.status } : null;
		// Watched films merge into the one on the list; watchlist films already there are left alone.
		return { ...f, existing, include: !existing || f.status === 'watched' };
	}

	const counts = $derived({
		want: rows.filter((r) => r.status === 'want' && !r.existing).length,
		watched: rows.filter((r) => r.status === 'watched' && !r.existing).length,
		existing: rows.filter((r) => r.existing).length
	});
	const shown = $derived(
		rows
			.map((r, i) => ({ r, i }))
			.filter(({ r }) =>
				filter === 'existing' ? !!r.existing : !r.existing && r.status === filter
			)
	);
	const chosen = $derived(rows.filter((r) => r.include));
	const summary = $derived({
		want: chosen.filter((r) => r.status === 'want').length,
		watched: chosen.filter((r) => r.status === 'watched').length,
		entries: chosen.reduce((n, r) => n + r.entries.length, 0)
	});
	const allShownIncluded = $derived(shown.length > 0 && shown.every(({ r }) => r.include));

	function setShown(include: boolean) {
		for (const { i } of shown) rows[i].include = include;
	}

	function stars(n: number | null) {
		if (!n) return '';
		return '★'.repeat(Math.floor(n / 2)) + (n % 2 ? '½' : '');
	}

	function flag(r: Row) {
		if (!r.existing) return null;
		const as = `Already on the list as “${r.existing.title}”.`;
		if (r.status === 'want') return `${as} Tick to add it again anyway.`;
		if (r.existing.status === 'watched')
			return `${as} ${r.include ? 'Your viewings will be added to its diary.' : 'Tick to add your viewings to its diary.'}`;
		return `${as} ${r.include ? 'It’ll be marked watched.' : 'Tick to mark it watched.'}`;
	}

	/** Batches small enough for the server's request size limit. */
	function batches(films: Row[]) {
		const out: object[][] = [];
		let batch: object[] = [];
		let size = 0;
		for (const r of films) {
			const film = {
				title: r.title,
				year: r.year,
				status: r.status,
				addedOn: r.addedOn,
				watchedOn: r.watchedOn,
				entries: r.entries,
				// A watchlist film ticked despite being on the list is added again as a new title.
				existingId: r.status === 'watched' ? (r.existing?.id ?? null) : null
			};
			const n = JSON.stringify(film).length;
			if (batch.length && (size + n > 300_000 || batch.length >= 250)) {
				out.push(batch);
				batch = [];
				size = 0;
			}
			batch.push(film);
			size += n;
		}
		if (batch.length) out.push(batch);
		return out;
	}

	async function importAll() {
		const parts = batches(chosen);
		const total = { added: 0, updated: 0, logged: 0 };
		progress = 0;
		try {
			for (const [n, part] of parts.entries()) {
				const body = new FormData();
				body.set('films', JSON.stringify(part));
				const res = await fetch('?/commit', {
					method: 'POST',
					body,
					headers: { 'x-sveltekit-action': 'true' }
				});
				const result = deserialize(await res.text());
				if (result.type !== 'success') {
					const message =
						result.type === 'failure'
							? (result.data as { message?: string } | undefined)?.message
							: null;
					throw new Error(message ?? 'The import stopped part way. Try again.');
				}
				const d = result.data as typeof total;
				total.added += d.added;
				total.updated += d.updated;
				total.logged += d.logged;
				progress = (n + 1) / parts.length;
			}
		} catch (e) {
			progress = null;
			const done = total.added + total.updated;
			toast.error(
				`${(e as Error).message}${done ? ` ${plural(done, 'film')} were saved; importing again skips them.` : ''}`
			);
			return;
		}
		const said = [
			`Imported ${plural(total.added, 'film')}`,
			total.updated ? `updated ${total.updated} already on the list` : '',
			total.logged ? `logged ${plural(total.logged, 'viewing')}` : ''
		].filter(Boolean);
		toast.success(`${said.join(', ')}. Posters will appear as they’re matched.`);
		await goto(summary.want ? '/' : '/watched', { invalidateAll: true });
	}
</script>

<svelte:head><title>Import from Letterboxd · Watchlist</title></svelte:head>

<div class="mb-6">
	<p class="label">Into {data.currentList?.name}</p>
	<h1 class="display mt-1 text-4xl sm:text-5xl">Import from Letterboxd</h1>
</div>

{#if step === 'choose'}
	<div class="grid gap-8 lg:grid-cols-[1fr_20rem]">
		<div class="grid content-start gap-4">
			<label
				class="grid cursor-pointer place-items-center gap-2 border border-dashed px-6 py-14 text-center transition-colors duration-150 hover:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-[var(--ring)]"
			>
				<span class="display text-2xl">{reading ? 'Reading…' : 'Choose your export'}</span>
				<span class="text-sm text-muted-foreground">
					The ZIP file from Letterboxd, or the CSV files inside it
				</span>
				<input
					type="file"
					accept=".zip,.csv,application/zip,text/csv"
					multiple
					class="sr-only"
					disabled={reading}
					onchange={(e) => choose(e.currentTarget.files)}
				/>
			</label>
			{#if readError}<p class="text-sm text-destructive">{readError}</p>{/if}
			<p class="text-sm text-muted-foreground">
				The file is read on this device. Nothing is saved until you’ve checked it.
			</p>
		</div>
		<aside class="text-sm leading-relaxed text-muted-foreground">
			<h2 class="label mb-2">Getting the export</h2>
			<p>
				On letterboxd.com, open Settings, then Data, and choose Export your data. It downloads as a
				ZIP; choose that here as it is.
			</p>
			<h2 class="label mt-6 mb-2">What comes across</h2>
			<ul class="grid gap-1.5">
				<li>Your watchlist, to watch, in the order you added it.</li>
				<li>Films you’ve seen, as watched.</li>
				<li>Each diary entry, with its date, rating and review, in your diary.</li>
				<li>Ratings without a diary entry, as an undated viewing.</li>
			</ul>
			<p class="mt-4">
				Films already on this list are spotted. Lists, likes and tags stay on Letterboxd.
			</p>
		</aside>
	</div>
{:else}
	<div
		class="sticky top-0 z-10 -mx-4 mb-4 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-3 sm:-mx-8 sm:px-8"
	>
		<p class="figures mr-auto text-sm">
			{#if progress !== null}
				Importing… {Math.round(progress * 100)}%
			{:else}
				<strong>{summary.want}</strong> to watch, <strong>{summary.watched}</strong>
				watched{#if summary.entries},
					{plural(summary.entries, 'diary entry', 'diary entries')}{/if}
			{/if}
		</p>
		<Button variant="ghost" disabled={progress !== null} onclick={() => (step = 'choose')}>
			Back
		</Button>
		<Button onclick={importAll} disabled={progress !== null || chosen.length === 0}>
			{progress !== null ? 'Importing…' : 'Import'}
		</Button>
	</div>

	<div class="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Show">
		{#each FILTERS as [id, name] (id)}
			{#if counts[id] || id !== 'existing'}
				<button
					type="button"
					aria-pressed={filter === id}
					class="flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
					onclick={() => (filter = id)}
				>
					{name} <span class="figures opacity-70">{counts[id]}</span>
				</button>
			{/if}
		{/each}
		{#if shown.length}
			<Button variant="ghost" size="sm" class="ml-auto" onclick={() => setShown(!allShownIncluded)}>
				{allShownIncluded ? 'Untick all' : 'Tick all'}
			</Button>
		{/if}
	</div>

	{#if shown.length === 0}
		<p class="border-t py-10 text-muted-foreground">
			{filter === 'want' ? 'Nothing new from your watchlist.' : 'No new watched films.'}
		</p>
	{:else}
		<ul class="divide-y border-y">
			{#each shown as { r, i } (r.key)}
				{@const latest = r.entries.find((e) => e.watchedOn)}
				{@const rated = r.entries.find((e) => e.rating)}
				<li>
					<label
						class="grid cursor-pointer grid-cols-[auto_1fr] gap-x-3 py-2.5 {r.include
							? ''
							: 'opacity-60'}"
					>
						<input
							type="checkbox"
							bind:checked={rows[i].include}
							class="mt-1.5 size-4 accent-[var(--primary)]"
						/>
						<span class="min-w-0">
							<span class="font-medium">{r.title}</span>
							{#if r.year}<span class="figures text-muted-foreground"> {r.year}</span>{/if}
							<span class="figures block text-xs text-muted-foreground">
								{[
									filter === 'existing'
										? r.status === 'want'
											? 'On your watchlist'
											: 'Watched'
										: '',
									rated ? stars(rated.rating) : '',
									latest ? `Last seen ${shortDate(latest.watchedOn)}` : '',
									r.entries.length > 1 ? plural(r.entries.length, 'viewing') : '',
									r.entries.some((e) => e.review) ? 'Reviewed' : '',
									r.status === 'want' && r.addedOn ? `Added ${shortDate(r.addedOn)}` : ''
								]
									.filter(Boolean)
									.join(' · ')}
							</span>
							{#if flag(r)}
								<span class="block text-xs font-medium text-foreground">{flag(r)}</span>
							{/if}
						</span>
					</label>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
