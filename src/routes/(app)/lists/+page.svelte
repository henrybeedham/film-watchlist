<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import Copy from '@lucide/svelte/icons/copy';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { longDate } from '#lib/format.js';
	import type { SubmitFunction } from '$app/forms';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const m = $derived(data.manage);

	async function copy(text: string, what: string) {
		try {
			await navigator.clipboard.writeText(text);
			toast.success(`${what} copied.`);
		} catch {
			toast(`Copy this ${what.toLowerCase()}: ${text}`);
		}
	}

	const quiet =
		() =>
		async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			await update({ reset: false });

	const copyInvite: SubmitFunction<{ invite?: string }> =
		() =>
		async ({ result, update }) => {
			const invite = result.type === 'success' ? result.data?.invite : undefined;
			if (invite) await copy(`${data.origin}/invite/${invite}`, 'Invite link');
			await update();
		};

	const shareUrl = $derived(m?.shareToken ? `${data.origin}/s/${m.shareToken}` : '');
</script>

<svelte:head><title>Lists · Watchlist</title></svelte:head>

<h1 class="display mb-8 text-4xl sm:text-5xl">Lists and sharing</h1>

<div class="grid gap-12 lg:grid-cols-[18rem_1fr]">
	<aside>
		<h2 class="label mb-3">Your lists</h2>
		<ul class="divide-y border-y">
			{#each data.lists ?? [] as list (list.id)}
				<li>
					<a
						href="/lists?list={list.id}"
						class="flex items-baseline gap-2 py-2.5 hover:text-foreground {m?.id === list.id
							? 'font-medium'
							: 'text-muted-foreground'}"
					>
						<span class="flex-1 truncate">{list.name}</span>
						<span class="figures text-xs text-muted-foreground">{list.wantCount}</span>
					</a>
				</li>
			{/each}
		</ul>
		<form method="POST" action="?/create" class="mt-5 grid gap-2" use:enhance>
			<Label for="new-list">New list</Label>
			<div class="flex gap-2">
				<Input id="new-list" name="name" placeholder="e.g. Horror for October" required />
				<Button type="submit" variant="outline">Create</Button>
			</div>
			{#if form?.createMessage}<p class="text-sm text-destructive">{form.createMessage}</p>{/if}
		</form>

		<section class="mt-10">
			<h2 class="label mb-1">Invite someone to Watchlist</h2>
			<p class="mb-3 text-sm text-muted-foreground">
				A link that lets one person make an account with a list of their own, without joining any of
				yours. Works once and lasts seven days.
			</p>
			<form method="POST" action="?/siteInvite" use:enhance={copyInvite}>
				<Button type="submit" variant="outline">Create and copy a link</Button>
			</form>
			{#if data.siteInvites.length}
				<ul class="mt-4 divide-y border-y text-sm">
					{#each data.siteInvites as inv (inv.token)}
						<li class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
							<button
								class="inline-flex min-w-0 items-center gap-1.5 font-mono text-xs hover:text-foreground"
								onclick={() => copy(`${data.origin}/invite/${inv.token}`, 'Invite link')}
								title="Copy"
							>
								<Copy class="size-3.5 shrink-0" strokeWidth={1.5} />
								<span class="truncate">/invite/{inv.token.slice(0, 8)}…</span>
							</button>
							<form method="POST" action="?/revokeSiteInvite" use:enhance={quiet} class="ml-auto">
								<input type="hidden" name="token" value={inv.token} />
								<button
									class="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
								>
									Cancel
								</button>
							</form>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</aside>

	{#if m}
		<div class="grid min-w-0 content-start gap-10">
			<section>
				<p class="label">
					{m.role === 'owner' ? 'You own this list' : 'You’re a member of this list'}
				</p>
				{#if m.role === 'owner'}
					<form
						method="POST"
						action="?/rename"
						class="mt-2 flex max-w-lg gap-2"
						use:enhance={quiet}
					>
						<input type="hidden" name="listId" value={m.id} />
						<Input
							name="name"
							value={m.name}
							aria-label="List name"
							class="display h-12 text-2xl"
						/>
						<Button type="submit" variant="outline" class="h-12">Rename</Button>
					</form>
					{#if form?.renameMessage}<p class="mt-2 text-sm text-destructive">
							{form.renameMessage}
						</p>{/if}
				{:else}
					<h2 class="display mt-2 text-3xl">{m.name}</h2>
				{/if}
			</section>

			<section>
				<h3 class="label mb-3">People</h3>
				<ul class="max-w-2xl divide-y border-y">
					{#each m.members as person (person.userId)}
						<li class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
							<span class="font-medium">{person.name}</span>
							<span class="truncate text-sm text-muted-foreground">{person.email}</span>
							<span class="ml-auto text-xs text-muted-foreground">
								{person.role === 'owner' ? 'Owner' : 'Can add and tick off'}
							</span>
							{#if m.role === 'owner' && person.role !== 'owner'}
								<form method="POST" action="?/removeMember" use:enhance={quiet}>
									<input type="hidden" name="listId" value={m.id} />
									<input type="hidden" name="userId" value={person.userId} />
									<button class="text-xs text-destructive underline underline-offset-4">
										Remove
									</button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
			</section>

			{#if m.role === 'owner'}
				<section class="max-w-2xl">
					<h3 class="label mb-1">Invite someone</h3>
					<p class="mb-3 text-sm text-muted-foreground">
						An invite link lets one person create an account (or use their existing one) and join
						this list. Each link works once and lasts seven days.
					</p>
					<form method="POST" action="?/invite" use:enhance={copyInvite}>
						<input type="hidden" name="listId" value={m.id} />
						<Button type="submit" variant="outline">Create and copy an invite link</Button>
					</form>
					{#if m.invites.length}
						<ul class="mt-4 divide-y border-y text-sm">
							{#each m.invites as inv (inv.token)}
								<li class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
									<button
										class="inline-flex min-w-0 items-center gap-1.5 font-mono text-xs hover:text-foreground"
										onclick={() => copy(`${data.origin}/invite/${inv.token}`, 'Invite link')}
										title="Copy"
									>
										<Copy class="size-3.5 shrink-0" strokeWidth={1.5} />
										<span class="truncate">/invite/{inv.token.slice(0, 8)}…</span>
									</button>
									<span class="text-muted-foreground">Expires {longDate(inv.expiresAt)}</span>
									<form method="POST" action="?/revokeInvite" use:enhance={quiet} class="ml-auto">
										<input type="hidden" name="listId" value={m.id} />
										<input type="hidden" name="token" value={inv.token} />
										<button
											class="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
										>
											Cancel
										</button>
									</form>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<section class="max-w-2xl">
					<h3 class="label mb-1">Share a read-only link</h3>
					<p class="mb-3 text-sm text-muted-foreground">
						Anyone with the link can see what’s on this list and what’s been watched, without
						signing in. They can’t change anything.
					</p>
					{#if m.shareToken}
						<div class="flex flex-wrap gap-2">
							<Input
								value={shareUrl}
								readonly
								class="min-w-0 flex-[1_1_16rem] font-mono text-xs"
								onfocus={(e: FocusEvent) => (e.currentTarget as HTMLInputElement).select()}
							/>
							<Button variant="outline" onclick={() => copy(shareUrl, 'Share link')}>Copy</Button>
						</div>
						<div class="mt-3 flex flex-wrap gap-4 text-sm">
							<form method="POST" action="?/share" use:enhance={quiet}>
								<input type="hidden" name="listId" value={m.id} />
								<input type="hidden" name="on" value="1" />
								<button
									class="text-muted-foreground underline underline-offset-4 hover:text-foreground"
								>
									Make a new link (the old one stops working)
								</button>
							</form>
							<form method="POST" action="?/share" use:enhance={quiet}>
								<input type="hidden" name="listId" value={m.id} />
								<input type="hidden" name="on" value="0" />
								<button class="text-destructive underline underline-offset-4">
									Turn sharing off
								</button>
							</form>
						</div>
					{:else}
						<form method="POST" action="?/share" use:enhance={quiet}>
							<input type="hidden" name="listId" value={m.id} />
							<input type="hidden" name="on" value="1" />
							<Button type="submit" variant="outline">Turn on the share link</Button>
						</form>
					{/if}
				</section>

				<section class="max-w-2xl border-t pt-6">
					<h3 class="label mb-1">Delete this list</h3>
					<p class="mb-3 text-sm text-muted-foreground">
						Removes every title on it and its diary, and {m.members.length > 1
							? m.members.length === 2
								? 'the other person on it loses access'
								: `the ${m.members.length - 1} other people on it lose access`
							: 'any share link stops working'}. Type “{m.name}” to confirm.
					</p>
					<form method="POST" action="?/delete" class="flex flex-wrap gap-2" use:enhance>
						<input type="hidden" name="listId" value={m.id} />
						<Input
							name="confirm"
							aria-label="List name to confirm"
							class="max-w-60"
							autocomplete="off"
						/>
						<Button type="submit" variant="destructive">Delete list</Button>
					</form>
					{#if form?.deleteMessage}<p class="mt-2 text-sm text-destructive">
							{form.deleteMessage}
						</p>{/if}
				</section>
			{:else}
				<section class="max-w-2xl border-t pt-6">
					<form method="POST" action="?/leave" use:enhance>
						<input type="hidden" name="listId" value={m.id} />
						<Button type="submit" variant="destructive">Leave this list</Button>
					</form>
					{#if form?.leaveMessage}<p class="mt-2 text-sm text-destructive">
							{form.leaveMessage}
						</p>{/if}
				</section>
			{/if}
		</div>
	{:else}
		<p class="text-muted-foreground">You’re not on any lists. Create one to get started.</p>
	{/if}
</div>
