<script lang="ts">
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { postAction } from '#lib/client/actions.js';
	import Wordmark from '#lib/components/Wordmark.svelte';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Menu from '@lucide/svelte/icons/menu';
	import Check from '@lucide/svelte/icons/check';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const tabs = [
		{ href: '/', label: 'To watch' },
		{ href: '/coming-soon', label: 'Coming soon', short: 'Soon' },
		{ href: '/watched', label: 'Watched' },
		{ href: '/tonight', label: 'Tonight' }
	];

	const active = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);

	// Switch list but stay on the same section. A title page belongs to one list, and the Lists
	// page shows whichever list is in its URL, so those two move to the new list's equivalent.
	async function switchList(id: number) {
		await postAction('/lists?/switch', { listId: id });
		const path = page.url.pathname;
		if (path.startsWith('/lists')) await goto(`/lists?list=${id}`, { refreshAll: true });
		else if (path.startsWith('/item/')) await goto('/', { refreshAll: true });
	}
</script>

<div class="flex min-h-dvh flex-col">
	<header class="border-b border-border pt-[env(safe-area-inset-top)]">
		<div class="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-4 pb-3 sm:px-8 sm:pt-6">
			<a href="/" class="text-2xl text-foreground sm:text-3xl" aria-label="Watchlist, home">
				<Wordmark />
			</a>

			{#if data.currentList}
				<div class="ml-1 min-w-0">
					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							class="flex max-w-[11rem] min-w-0 items-center gap-1 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground sm:max-w-xs"
						>
							<span class="truncate">{data.currentList.name}</span>
							<ChevronDown class="size-3.5 shrink-0" strokeWidth={1.5} />
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="start" class="min-w-56">
							<DropdownMenu.Label class="label">Your lists</DropdownMenu.Label>
							{#each data.lists as list (list.id)}
								<DropdownMenu.Item onSelect={() => switchList(list.id)}>
									<span class="flex-1 truncate">{list.name}</span>
									<span class="figures text-xs text-muted-foreground">{list.wantCount}</span>
									{#if list.id === data.currentList.id}<Check
											class="size-3.5"
											strokeWidth={1.5}
										/>{/if}
								</DropdownMenu.Item>
							{/each}
							<DropdownMenu.Separator />
							<DropdownMenu.Item onSelect={() => (location.href = '/lists')}>
								Manage lists and sharing
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
			{/if}

			<div class="ml-auto flex items-center gap-1">
				<nav class="hidden items-center gap-1 text-sm md:flex" aria-label="More">
					<a
						class="rounded-md px-2.5 py-1.5 hover:bg-accent {active('/lists')
							? 'text-foreground'
							: 'text-muted-foreground'}"
						href="/lists"
					>
						Lists
					</a>
					<a
						class="rounded-md px-2.5 py-1.5 hover:bg-accent {active('/settings')
							? 'text-foreground'
							: 'text-muted-foreground'}"
						href="/settings"
					>
						Settings
					</a>
					{#if data.admin}
						<a
							class="rounded-md px-2.5 py-1.5 hover:bg-accent {active('/admin')
								? 'text-foreground'
								: 'text-muted-foreground'}"
							href="/admin"
						>
							Admin
						</a>
					{/if}
				</nav>
				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
						aria-label="Menu"
					>
						<Menu class="size-5" strokeWidth={1.5} />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="min-w-44">
						<DropdownMenu.Item onSelect={() => (location.href = '/lists')}>
							Lists and sharing
						</DropdownMenu.Item>
						<DropdownMenu.Item onSelect={() => (location.href = '/settings')}>
							Settings
						</DropdownMenu.Item>
						{#if data.admin}
							<DropdownMenu.Item onSelect={() => (location.href = '/admin')}>
								Admin
							</DropdownMenu.Item>
						{/if}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</div>

		<nav class="mx-auto flex max-w-6xl gap-5 px-4 sm:gap-7 sm:px-8" aria-label="Sections">
			{#each tabs as tab (tab.href)}
				<a
					href={tab.href}
					aria-current={active(tab.href) ? 'page' : undefined}
					class="-mb-px border-b-2 py-2.5 text-sm transition-colors duration-150
						{active(tab.href)
						? 'border-primary font-medium text-foreground'
						: 'border-transparent text-muted-foreground hover:text-foreground'}"
				>
					{#if tab.short}<span class="sm:hidden">{tab.short}</span><span class="hidden sm:inline">
							{tab.label}
						</span>{:else}{tab.label}{/if}
				</a>
			{/each}
		</nav>
	</header>

	<main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
		{#if data.requests.length}
			<ul class="mb-8 divide-y border-y" aria-label="Invitations">
				{#each data.requests as req (req.listId)}
					<li class="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
						<p class="min-w-0 flex-[1_1_16rem]">
							{req.invitedBy} has invited you to join
							<span class="font-medium">{req.listName}</span>
						</p>
						<div class="flex gap-2">
							<form
								method="POST"
								action="/lists?/decline"
								use:enhance={() =>
									async ({ result, update }) => {
										if (result.type === 'success') toast(`Declined ${req.listName}.`);
										await update();
									}}
							>
								<input type="hidden" name="listId" value={req.listId} />
								<Button type="submit" variant="outline" size="sm">Decline</Button>
							</form>
							<form
								method="POST"
								action="/lists?/accept"
								use:enhance={() =>
									async ({ result, update }) => {
										if (result.type === 'redirect') {
											toast.success(`You’ve joined ${req.listName}.`);
											await goto(result.location, { invalidateAll: true });
										} else {
											if (result.type === 'failure')
												toast.error('That invitation has been withdrawn.');
											await update();
										}
									}}
							>
								<input type="hidden" name="listId" value={req.listId} />
								<Button type="submit" size="sm">Accept</Button>
							</form>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
		{@render children()}
	</main>

	<footer class="border-t border-border">
		<div
			class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground sm:px-8"
		>
			{#if data.tmdbEnabled}
				<span>
					Film data from TMDB. This product uses the TMDB API but is not endorsed or certified by
					TMDB. Streaming data from JustWatch.
				</span>
			{/if}
			<span class="ml-auto">
				Signed in as {data.user?.name}.
				<form method="POST" action="/signout" class="inline" use:enhance>
					<button class="underline underline-offset-4 hover:text-foreground">Sign out</button>
				</form>
			</span>
		</div>
	</footer>
</div>
