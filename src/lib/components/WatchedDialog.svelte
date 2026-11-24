<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import StarInput from './StarInput.svelte';
	import { postAction } from '#lib/client/actions.js';
	import { todayIso } from '#lib/format.js';

	let {
		open = $bindable(false),
		item,
		again = false,
		actionBase = ''
	}: {
		open?: boolean;
		item: { id: number; displayTitle: string } | null;
		/** Logging another viewing of something already watched. */
		again?: boolean;
		/** Path of the page whose actions to use, e.g. '/item/4'. Empty means this page. */
		actionBase?: string;
	} = $props();

	let rating = $state<number | null>(null);
	let busy = $state(false);

	$effect(() => {
		if (open) rating = null;
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		{#if item}
			{@const current = item}
			<form
				method="POST"
				action="{actionBase}?/watched"
				class="grid gap-5"
				use:enhance={({ submitter, formData }) => {
					busy = true;
					if (submitter?.getAttribute('value') === 'skip') formData.set('skipDiary', '1');
					return async ({ result, update }) => {
						busy = false;
						if (result.type === 'success') {
							open = false;
							if (again) toast.success('Added to the diary.');
							else
								toast.success(`Ticked off “${current.displayTitle}”.`, {
									action: {
										label: 'Undo',
										onClick: () => void postAction(`${actionBase}?/unwatch`, { itemId: current.id })
									}
								});
						}
						await update({ reset: false });
					};
				}}
			>
				<Dialog.Header>
					<p class="label">{again ? 'Watched it again' : 'Watched'}</p>
					<Dialog.Title>{current.displayTitle}</Dialog.Title>
				</Dialog.Header>
				<input type="hidden" name="itemId" value={current.id} />
				<div class="grid gap-2">
					<Label for="watchedOn">Date watched</Label>
					<Input
						id="watchedOn"
						name="watchedOn"
						type="date"
						value={todayIso()}
						max={todayIso()}
						class="w-44"
					/>
				</div>
				<div class="grid gap-2">
					<span class="text-sm font-medium">Your rating</span>
					<StarInput bind:value={rating} />
				</div>
				<div class="grid gap-2">
					<Label for="review">
						A few words <span class="font-normal text-muted-foreground">(optional)</span>
					</Label>
					<Textarea id="review" name="review" rows={3} placeholder="What did you make of it?" />
				</div>
				<div class="flex flex-wrap items-center gap-2">
					<Button type="submit" disabled={busy}>{again ? 'Add to diary' : 'Save to diary'}</Button>
					{#if !again}
						<Button type="submit" variant="ghost" value="skip" disabled={busy}>
							Just tick it off
						</Button>
					{/if}
				</div>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>
