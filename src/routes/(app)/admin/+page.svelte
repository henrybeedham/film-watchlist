<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import Ellipsis from '@lucide/svelte/icons/ellipsis';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { postAction } from '#lib/client/actions.js';
	import { plural, shortDate } from '#lib/format.js';
	import { THEMES } from '#lib/themes.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let siteForm: HTMLFormElement | undefined = $state();

	type SiteUser = (typeof data.users)[number];
	let passwordFor = $state<SiteUser | null>(null);
	let deleting = $state<SiteUser | null>(null);

	const admins = $derived(data.users.filter((u) => u.admin).length);

	// Every admin action answers with { done } or fails with { message }: show it as a toast.
	function announce(result: Awaited<ReturnType<typeof postAction>>) {
		if (result.type === 'success') {
			const done: unknown = result.data?.done;
			if (typeof done === 'string') toast.success(done);
		} else if (result.type === 'failure') {
			const message: unknown = result.data?.message;
			toast.error(typeof message === 'string' ? message : 'That didn’t work.');
		}
	}

	const report: SubmitFunction =
		() =>
		async ({ result, update }) => {
			announce(result);
			if (result.type === 'success') {
				passwordFor = null;
				deleting = null;
			}
			await update({ reset: false });
		};

	async function act(action: string, user: SiteUser) {
		announce(await postAction(`?/${action}`, { userId: user.id }));
	}

	function lists(u: SiteUser) {
		const parts = [plural(u.ownedLists, 'list')];
		if (u.memberOf) parts.push(`member of ${u.memberOf}`);
		return parts.join(', ');
	}
</script>

<svelte:head><title>Admin · Watchlist</title></svelte:head>

<p class="label">Runs the whole site</p>
<h1 class="display mb-8 text-4xl sm:text-5xl">Admin</h1>

<form method="POST" action="?/siteTheme" bind:this={siteForm} use:enhance={report}>
	<section class="mb-12">
		<h2 class="label mb-1">Site default theme</h2>
		<p class="mb-3 max-w-xl text-sm text-muted-foreground">
			What everyone sees unless they pick their own theme, including on sign-in pages.
		</p>
		<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Site default theme">
			{#each THEMES as t (t.id)}
				<label
					class="flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-2 has-focus-visible:ring-[var(--ring)]"
				>
					<input
						type="radio"
						name="siteTheme"
						value={t.id}
						checked={data.siteTheme === t.id}
						class="sr-only"
						onchange={() => siteForm?.requestSubmit()}
					/>
					{t.name}
				</label>
			{/each}
		</div>
	</section>
</form>

<section class="mb-12">
	<h2 class="label mb-1">People</h2>
	<p class="mb-4 max-w-xl text-sm text-muted-foreground">
		{plural(data.users.length, 'account')}, {plural(admins, 'admin')}. New people join with an
		invite link from Settings or from a list.
	</p>

	<ul class="divide-y border-y">
		{#each data.users as u (u.id)}
			<li class="flex items-start gap-3 py-3">
				<div class="min-w-0 flex-1">
					<p class="flex flex-wrap items-baseline gap-x-2">
						<span class="truncate font-medium">{u.name}</span>
						{#if u.id === data.me}<span class="text-xs text-muted-foreground">You</span>{/if}
						{#if u.admin}
							<span class="label text-[0.65rem] text-primary">Admin</span>
						{/if}
					</p>
					<p class="truncate text-sm text-muted-foreground">{u.email}</p>
					<p class="figures mt-1 text-xs text-muted-foreground">
						Joined {shortDate(u.joinedAt)} · {u.lastSeenAt
							? `last seen ${shortDate(u.lastSeenAt)}`
							: 'signed out'} · {lists(u)} · {plural(u.items, 'title')} added
					</p>
				</div>

				<DropdownMenu.Root>
					<DropdownMenu.Trigger
						class="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
						aria-label="Manage {u.name}"
					>
						<Ellipsis class="size-4" strokeWidth={1.5} />
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="min-w-52">
						{#if u.admin}
							<DropdownMenu.Item disabled={admins <= 1} onSelect={() => act('removeAdmin', u)}>
								{u.id === data.me ? 'Stop being an admin' : 'Remove as admin'}
							</DropdownMenu.Item>
						{:else}
							<DropdownMenu.Item onSelect={() => act('makeAdmin', u)}>Make admin</DropdownMenu.Item>
						{/if}
						<DropdownMenu.Item onSelect={() => (passwordFor = u)}>
							Set a new password…
						</DropdownMenu.Item>
						{#if u.id !== data.me}
							<DropdownMenu.Item onSelect={() => act('signOut', u)}>
								Sign out everywhere
							</DropdownMenu.Item>
							<DropdownMenu.Separator />
							<DropdownMenu.Item class="text-destructive" onSelect={() => (deleting = u)}>
								Delete account…
							</DropdownMenu.Item>
						{/if}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</li>
		{/each}
	</ul>
</section>

<Dialog.Root open={!!passwordFor} onOpenChange={(o) => !o && (passwordFor = null)}>
	<Dialog.Content>
		{#if passwordFor}
			<Dialog.Header>
				<Dialog.Title>New password for {passwordFor.name}</Dialog.Title>
				<Dialog.Description>
					For when someone’s forgotten theirs. Send it to them privately; they can change it in
					Settings. They’ll be signed out on every device.
				</Dialog.Description>
			</Dialog.Header>
			<form method="POST" action="?/password" class="grid gap-4" use:enhance={report}>
				<input type="hidden" name="userId" value={passwordFor.id} />
				<div class="grid gap-2">
					<Label for="admin-password">New password</Label>
					<Input
						id="admin-password"
						name="password"
						type="text"
						autocomplete="off"
						minlength={8}
						maxlength={128}
						required
					/>
				</div>
				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (passwordFor = null)}>
						Cancel
					</Button>
					<Button type="submit">Set password</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root open={!!deleting} onOpenChange={(o) => !o && (deleting = null)}>
	<Dialog.Content>
		{#if deleting}
			<Dialog.Header>
				<Dialog.Title>Delete {deleting.name}’s account?</Dialog.Title>
				<Dialog.Description>
					{#if deleting.ownedLists - deleting.sharedLists > 0}
						Their {plural(deleting.ownedLists - deleting.sharedLists, 'list')} that nobody else uses will
						be deleted.
					{/if}
					{#if deleting.sharedLists > 0}
						{plural(deleting.sharedLists, 'shared list')} will pass to another member.
					{/if}
					Titles they added to other people’s lists stay. This can’t be undone.
				</Dialog.Description>
			</Dialog.Header>
			<form method="POST" action="?/delete" use:enhance={report}>
				<input type="hidden" name="userId" value={deleting.id} />
				<Dialog.Footer>
					<Button type="button" variant="outline" onclick={() => (deleting = null)}>Cancel</Button>
					<Button type="submit" variant="destructive">Delete account</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
