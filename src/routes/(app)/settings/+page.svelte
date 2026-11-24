<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { logo } from '#lib/format.js';
	import { MODES, THEMES } from '#lib/themes.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let appearanceForm: HTMLFormElement | undefined = $state();
	let selectedServices = $derived(new Set(data.services));

	// Previews follow the light/dark mode currently showing.
	let dark = $state(false);
	$effect(() => {
		void data.mode;
		const root = document.documentElement;
		dark = root.classList.contains('dark');
		const obs = new MutationObserver(() => (dark = root.classList.contains('dark')));
		obs.observe(root, { attributes: true, attributeFilter: ['class'] });
		return () => obs.disconnect();
	});

	const siteName = $derived(THEMES.find((t) => t.id === data.siteTheme)?.name ?? '');
	const themeOptions = $derived([
		{
			value: 'site',
			id: data.siteTheme,
			name: 'Site default',
			blurb: `Currently ${siteName}. Follows the site if its default changes.`,
			checked: data.themeChoice === null
		},
		...THEMES.map((t) => ({
			value: t.id,
			id: t.id,
			name: t.name,
			blurb: t.blurb,
			checked: data.themeChoice === t.id
		}))
	]);

	const quiet =
		() =>
		async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			await update({ reset: false });
</script>

<svelte:head><title>Settings · Watchlist</title></svelte:head>

<h1 class="display mb-8 text-4xl sm:text-5xl">Settings</h1>

<form method="POST" action="?/appearance" bind:this={appearanceForm} use:enhance={quiet}>
	<section class="mb-12">
		<h2 class="label mb-1">Theme</h2>
		<p class="mb-4 text-sm text-muted-foreground">Only changes how it looks for you.</p>
		<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
			{#each themeOptions as t (t.value)}
				<label class="group cursor-pointer">
					<input
						type="radio"
						name="theme"
						value={t.value}
						checked={t.checked}
						class="peer sr-only"
						onchange={() => appearanceForm?.requestSubmit()}
					/>
					<!-- A live specimen, drawn with the theme's own tokens. -->
					<div
						data-theme={t.id}
						class="{dark
							? 'dark'
							: ''} rounded-[var(--radius)] border bg-background p-4 text-foreground ring-offset-2 ring-offset-[var(--background)] transition-shadow duration-150 group-hover:border-foreground/40 peer-checked:ring-2 peer-checked:ring-[var(--ring)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ring)]"
						style="font-family: var(--font-body-face)"
					>
						<div class="flex items-start gap-3">
							<div class="aspect-[2/3] w-10 shrink-0 rounded-sm bg-highlight/80"></div>
							<div class="min-w-0">
								<p class="display text-xl">The Usual Suspects</p>
								<p class="mt-0.5 text-xs text-muted-foreground">1995 · Film · 1 h 46 min</p>
							</div>
							<span class="ml-auto font-mono text-xs text-primary">×2</span>
						</div>
						<div class="mt-3 flex items-center gap-2">
							<span
								class="rounded-[var(--radius)] bg-primary px-2 py-1 text-[0.65rem] text-primary-foreground"
							>
								Watched it
							</span>
							<span class="h-px flex-1 bg-border"></span>
						</div>
					</div>
					<p class="mt-2 font-medium">{t.name}</p>
					<p class="text-sm text-muted-foreground">{t.blurb}</p>
				</label>
			{/each}
		</div>
	</section>

	<section class="mb-12">
		<h2 class="label mb-3">Light or dark</h2>
		<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Light or dark">
			{#each MODES as m (m.id)}
				<label
					class="flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-2 has-focus-visible:ring-[var(--ring)]"
				>
					<input
						type="radio"
						name="mode"
						value={m.id}
						checked={data.mode === m.id}
						class="sr-only"
						onchange={() => appearanceForm?.requestSubmit()}
					/>
					{m.name}
				</label>
			{/each}
		</div>
	</section>
</form>

{#if data.tmdbEnabled}
	<section class="mb-12">
		<h2 class="label mb-1">Your streaming services</h2>
		<p class="mb-4 max-w-xl text-sm text-muted-foreground">
			Tick the ones you pay for. They’re shown first and highlighted, and you can filter the list
			and tonight’s pick to them.
		</p>
		<form
			method="POST"
			action="?/services"
			use:enhance={() =>
				async ({ result, update }) => {
					if (result.type === 'success') toast.success('Services saved.');
					await update({ reset: false });
				}}
		>
			<ul class="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-x-4 gap-y-1">
				{#each data.catalogue as p (p.id)}
					{@const src = logo(p.logo)}
					<li>
						<label
							class="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1.5 text-sm hover:bg-accent"
						>
							<input
								type="checkbox"
								name="service"
								value={p.name}
								checked={selectedServices.has(p.name)}
								class="accent-[var(--primary)]"
							/>
							<span class="size-7 shrink-0 overflow-hidden rounded-[22%] bg-muted">
								{#if src}<img {src} alt="" class="size-full object-cover" loading="lazy" />{/if}
							</span>
							<span class="truncate">{p.name}</span>
						</label>
					</li>
				{/each}
			</ul>
			<Button type="submit" class="mt-4">Save services</Button>
		</form>
	</section>
{/if}

<section class="mb-12 grid max-w-3xl gap-10 sm:grid-cols-2">
	<form
		method="POST"
		action="?/name"
		class="grid content-start gap-3"
		use:enhance={() =>
			async ({ result, update }) => {
				if (result.type === 'success') toast.success('Name saved.');
				await update({ reset: false });
			}}
	>
		<h2 class="label">Your name</h2>
		<div class="grid gap-2">
			<Label for="name" class="sr-only">Name</Label>
			<Input id="name" name="name" value={data.user?.name ?? ''} autocomplete="name" />
			<p class="text-xs text-muted-foreground">
				Shown to people you share lists with. Signed in as {data.user?.email}.
			</p>
		</div>
		{#if form?.nameMessage}<p class="text-sm text-destructive">{form.nameMessage}</p>{/if}
		<Button type="submit" variant="outline" class="justify-self-start">Save name</Button>
	</form>

	<form
		method="POST"
		action="?/password"
		class="grid content-start gap-3"
		use:enhance={() =>
			async ({ result, update }) => {
				if (result.type === 'success')
					toast.success('Password changed. Other devices have been signed out.');
				await update();
			}}
	>
		<h2 class="label">Change password</h2>
		<div class="grid gap-2">
			<Label for="current">Current password</Label>
			<Input id="current" name="current" type="password" autocomplete="current-password" required />
		</div>
		<div class="grid gap-2">
			<Label for="new">New password</Label>
			<Input
				id="new"
				name="new"
				type="password"
				autocomplete="new-password"
				minlength={8}
				required
			/>
		</div>
		{#if form?.passwordMessage}<p class="text-sm text-destructive">{form.passwordMessage}</p>{/if}
		<Button type="submit" variant="outline" class="justify-self-start">Change password</Button>
	</form>
</section>

<section class="mb-12 max-w-xl">
	<h2 class="label mb-1">Letterboxd</h2>
	<p class="mb-3 text-sm text-muted-foreground">
		Bring over your watchlist, the films you’ve seen, and your diary with its ratings and reviews.
	</p>
	<Button href="/import" variant="outline">Import from Letterboxd</Button>
</section>

<section class="mb-12 max-w-xl">
	<h2 class="label mb-1">Invite someone to Watchlist</h2>
	<p class="mb-3 text-sm text-muted-foreground">
		They get their own account and list, without joining any of yours. The link works once and lasts
		seven days.
	</p>
	<form
		method="POST"
		action="?/invite"
		use:enhance={() =>
			async ({ result }) => {
				const token = result.type === 'success' ? result.data?.invite : undefined;
				if (typeof token !== 'string') return void toast.error('Couldn’t make an invite link.');
				const link = `${location.origin}/invite/${token}`;
				try {
					await navigator.clipboard.writeText(link);
					toast.success('Invite link copied. Send it to them.');
				} catch {
					toast(`Send them this link: ${link}`, { duration: 30_000 });
				}
			}}
	>
		<Button type="submit" variant="outline">Invite someone</Button>
	</form>
</section>

<section class="max-w-xl border-t pt-6">
	<h2 class="label mb-2">On your phone</h2>
	<p class="text-sm leading-relaxed text-muted-foreground">
		In Safari, tap Share, then Add to Home Screen. Watchlist opens like an app, and the box at the
		top of To watch is the quickest way to add something the moment it’s recommended.
	</p>
</section>
