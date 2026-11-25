<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Check from '@lucide/svelte/icons/check';
	import Magnet from '@lucide/svelte/icons/magnet';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import Poster from '#lib/components/Poster.svelte';
	import WatchedDialog from '#lib/components/WatchedDialog.svelte';
	import MatchDialog from '#lib/components/MatchDialog.svelte';
	import MagnetResults from '#lib/components/MagnetResults.svelte';
	import { kindLabel, logo, longDate, runtime, stars, year } from '#lib/format.js';
	import type { Provider } from '#lib/types.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const item = $derived(data.item);
	const d = $derived(item.details);
	const y = $derived(year(item.releaseDate) ?? item.yearHint);
	const back = $derived(
		item.status === 'watched'
			? { href: '/watched', label: 'Watched' }
			: item.comingSoon
				? { href: '/coming-soon', label: 'Coming soon' }
				: { href: '/', label: 'To watch' }
	);

	let watchedOpen = $state(false);
	let editOpen = $state(false);
	let matchOpen = $state(false);
	let removeOpen = $state(false);

	let magnetSrc = $state<string | null>(null);
	let magnetsLoading = $state(false);
	$effect(() => {
		void item.id;
		magnetSrc = null;
	});

	const groups = $derived(
		d?.providers
			? (
					[
						['Stream', d.providers.stream],
						['Free', d.providers.free],
						['Rent', d.providers.rent],
						['Buy', d.providers.buy]
					] as [string, Provider[]][]
				).filter(([, list]) => list.length)
			: []
	);
</script>

<svelte:head><title>{item.displayTitle} · Watchlist</title></svelte:head>

<a
	href={back.href}
	class="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
>
	<ArrowLeft class="size-4" strokeWidth={1.5} />
	{back.label}
</a>

<article
	class="grid gap-6 sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-10 lg:grid-cols-[minmax(0,16rem)_1fr]"
>
	<div class="w-36 sm:w-full">
		<Poster
			path={d?.posterPath}
			title={item.displayTitle}
			size="w500"
			placeholder={data.view === 'grid' ? 'w342' : 'w185'}
			class="w-full"
		/>
	</div>

	<div class="min-w-0">
		<p class="label figures">
			{[
				kindLabel(item.mediaType),
				y,
				d?.mediaType === 'tv' && d.seasons
					? `${d.seasons} season${d.seasons === 1 ? '' : 's'}`
					: '',
				runtime(d?.runtime) &&
					(d?.mediaType === 'tv' ? `${runtime(d?.runtime)} episodes` : runtime(d?.runtime))
			]
				.filter(Boolean)
				.join(' · ')}
		</p>
		<h1 class="display mt-2 text-4xl [overflow-wrap:anywhere] sm:text-6xl">{item.displayTitle}</h1>
		{#if d?.originalTitle && d.originalTitle !== d.title}
			<p class="mt-1 text-muted-foreground italic">{d.originalTitle}</p>
		{/if}
		{#if item.title !== item.displayTitle}
			<p class="mt-1 text-sm text-muted-foreground">On your list as “{item.title}”</p>
		{/if}

		{#if item.comingSoon}
			<p class="mt-4 inline-block border-l-2 border-highlight pl-3 font-medium">
				{item.releaseDate
					? `Out in the UK on ${longDate(item.releaseDate)}`
					: 'Not out yet. No release date announced.'}
			</p>
		{/if}

		{#if d?.genres.length}
			<p class="mt-4 text-sm text-muted-foreground">{d.genres.join(', ')}</p>
		{/if}
		{#if d?.overview}
			<p class="mt-4 max-w-2xl text-[1.0625rem] leading-relaxed">{d.overview}</p>
		{/if}

		<dl class="mt-6 grid max-w-2xl grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
			{#if item.mentions > 1}
				<dt class="text-muted-foreground">Suggested</dt>
				<dd class="figures">{item.mentions} times</dd>
			{/if}
			{#if item.recommendedBy}
				<dt class="text-muted-foreground">From</dt>
				<dd>{item.recommendedBy}</dd>
			{/if}
			{#if item.note}
				<dt class="text-muted-foreground">Note</dt>
				<dd>{item.note}</dd>
			{/if}
			<dt class="text-muted-foreground">Added</dt>
			<dd>
				{longDate(item.createdAt)}{item.addedByName ? ` by ${item.addedByName}` : ''} to {data.listName}
			</dd>
		</dl>

		<div class="mt-6 flex flex-wrap gap-2">
			{#if item.status === 'want'}
				<Button onclick={() => (watchedOpen = true)}>
					<Check class="size-4" strokeWidth={1.75} />Watched it
				</Button>
				<form
					method="POST"
					action="?/mention"
					use:enhance={() =>
						async ({ update, result }) => {
							if (result.type === 'success') toast.success('Noted: suggested again.');
							await update();
						}}
				>
					<input type="hidden" name="itemId" value={item.id} />
					<Button type="submit" variant="outline">Suggested again</Button>
				</form>
			{:else}
				<Button onclick={() => (watchedOpen = true)} variant="outline">Log another viewing</Button>
				<form method="POST" action="?/unwatch" use:enhance>
					<input type="hidden" name="itemId" value={item.id} />
					<Button type="submit" variant="ghost">Put back on the list</Button>
				</form>
			{/if}
			<Button variant="ghost" onclick={() => (editOpen = true)}>Edit</Button>
			{#if data.magnetsEnabled}
				<Button
					variant="ghost"
					disabled={magnetsLoading}
					onclick={() => (magnetSrc = `/api/magnets?item=${item.id}&t=${Date.now()}`)}
				>
					<Magnet class="size-4" strokeWidth={1.5} />
					{magnetsLoading ? 'Searching…' : 'Find magnet'}
				</Button>
			{/if}
		</div>

		{#if magnetSrc}
			<div class="mt-8"><MagnetResults src={magnetSrc} bind:loading={magnetsLoading} /></div>
		{/if}

		{#if data.tmdbEnabled}
			{#if item.matchStatus === 'guess'}
				<p class="mt-5 max-w-2xl border-l-2 border-border pl-3 text-sm text-muted-foreground">
					This was matched by a best guess from “{item.title}”.
					<button
						class="underline underline-offset-4 hover:text-foreground"
						onclick={() => (matchOpen = true)}
					>
						Not the right one?
					</button>
				</p>
			{:else if item.matchStatus === 'none'}
				<p class="mt-5 max-w-2xl border-l-2 border-border pl-3 text-sm text-muted-foreground">
					Couldn’t find “{item.title}” on TMDB, so there’s no poster or streaming info.
					<button
						class="underline underline-offset-4 hover:text-foreground"
						onclick={() => (matchOpen = true)}
					>
						Search for it
					</button>
				</p>
			{:else if item.matchStatus === 'pending'}
				<p class="mt-5 text-sm text-muted-foreground">Looking up details…</p>
			{:else}
				<button
					class="mt-5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
					onclick={() => (matchOpen = true)}
				>
					Wrong film or series?
				</button>
			{/if}
		{/if}

		{#if d && item.status === 'want'}
			<section class="mt-10 max-w-2xl">
				<h2 class="label mb-3">Where to watch in the UK</h2>
				{#if groups.length}
					<div class="grid gap-4">
						{#each groups as [label, list] (label)}
							<div class="grid grid-cols-[4rem_1fr] items-start gap-3">
								<span class="pt-2 text-sm text-muted-foreground">{label}</span>
								<ul class="flex flex-wrap gap-x-4 gap-y-2">
									{#each list as p (p.id)}
										{@const src = logo(p.logo)}
										{@const mine = data.services.includes(p.name)}
										<li class="flex items-center gap-2 text-sm">
											<span class="size-9 overflow-hidden rounded-[22%] bg-muted">
												{#if src}<img
														{src}
														alt=""
														class="size-full object-cover"
														loading="lazy"
													/>{/if}
											</span>
											<span class={mine ? 'font-medium' : ''}>
												{p.name}{#if mine}<span
														class="block text-xs font-normal text-muted-foreground"
													>
														You have this
													</span>{/if}
											</span>
										</li>
									{/each}
								</ul>
							</div>
						{/each}
					</div>
					{#if d.providers?.link}
						<a
							href={d.providers.link}
							target="_blank"
							rel="noopener noreferrer"
							class="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
						>
							All options and prices on TMDB <ExternalLink class="size-3.5" strokeWidth={1.5} />
						</a>
					{/if}
				{:else}
					<p class="text-muted-foreground">
						Not streaming, for rent or for sale in the UK right now.
					</p>
				{/if}
			</section>
		{/if}

		{#if item.diary.length}
			<section class="mt-10 max-w-2xl">
				<h2 class="label mb-3">Diary</h2>
				<ul class="divide-y border-y">
					{#each item.diary as e (e.id)}
						<li class="py-3">
							<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
								<span class="font-medium">{e.userName}</span>
								<span class="text-sm text-muted-foreground">
									{e.watchedOn ? longDate(e.watchedOn) : 'Date not recorded'}
								</span>
								{#if e.rating}<span
										class="figures text-highlight brightness-90 dark:brightness-100"
										aria-label="{stars(e.rating)} out of 5 stars"
									>
										{'★'.repeat(Math.floor(e.rating / 2))}{e.rating % 2 ? '½' : ''}
									</span>{/if}
								{#if e.userId === data.user?.id}
									<form method="POST" action="?/deleteDiary" use:enhance class="ml-auto">
										<input type="hidden" name="diaryId" value={e.id} />
										<button
											class="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
										>
											Delete
										</button>
									</form>
								{/if}
							</div>
							{#if e.review}<p class="mt-1.5 leading-relaxed whitespace-pre-line">
									{e.review}
								</p>{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<button
			class="mt-12 text-sm text-destructive underline underline-offset-4"
			onclick={() => (removeOpen = true)}
		>
			Remove from this list
		</button>
	</div>
</article>

<WatchedDialog bind:open={watchedOpen} {item} again={item.status === 'watched'} />
{#if data.tmdbEnabled}
	<MatchDialog bind:open={matchOpen} initial={item.title} />
{/if}

<Dialog.Root bind:open={editOpen}>
	<Dialog.Content>
		<form
			method="POST"
			action="?/edit"
			class="grid gap-4"
			use:enhance={() =>
				async ({ result, update }) => {
					if (result.type === 'success') {
						editOpen = false;
						toast.success('Saved.');
					}
					await update({ reset: false });
				}}
		>
			<Dialog.Header><Dialog.Title>Edit</Dialog.Title></Dialog.Header>
			<div class="grid gap-2">
				<Label for="e-title">Title as written</Label>
				<Input id="e-title" name="title" value={item.title} required />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="grid gap-2">
					<Label for="e-rec">Recommended by</Label>
					<Input id="e-rec" name="recommendedBy" value={item.recommendedBy ?? ''} />
				</div>
				<div class="grid gap-2">
					<Label for="e-mentions">Times suggested</Label>
					<Input
						id="e-mentions"
						name="mentions"
						type="number"
						min="1"
						max="99"
						value={item.mentions}
						class="figures"
					/>
				</div>
			</div>
			<div class="grid gap-2">
				<Label for="e-note">Note</Label>
				<Textarea id="e-note" name="note" rows={2} value={item.note ?? ''} />
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div class="grid gap-2">
					<Label for="e-release">UK release date</Label>
					<Input
						id="e-release"
						name="releaseOverride"
						type="date"
						value={item.releaseOverride ?? ''}
					/>
					<p class="text-xs text-muted-foreground">Only if TMDB’s is missing or wrong.</p>
				</div>
				<div class="grid gap-2">
					<Label for="e-kind">Type</Label>
					<select
						id="e-kind"
						name="kindHint"
						class="h-9 rounded-md border border-input bg-card px-2 text-sm"
					>
						<option value="" selected={!item.kindHint}>Work it out</option>
						<option value="movie" selected={item.kindHint === 'movie'}>Film</option>
						<option value="tv" selected={item.kindHint === 'tv'}>Series</option>
					</select>
				</div>
			</div>
			<div><Button type="submit">Save</Button></div>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={removeOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Remove “{item.displayTitle}”?</Dialog.Title>
			<Dialog.Description>
				It’s taken off {data.listName} along with its diary entries. This can’t be undone.
			</Dialog.Description>
		</Dialog.Header>
		<form method="POST" action="?/remove" class="flex gap-2">
			<Button type="submit" variant="destructive">Remove</Button>
			<Button variant="ghost" onclick={() => (removeOpen = false)}>Keep it</Button>
		</form>
	</Dialog.Content>
</Dialog.Root>
