<script lang="ts">
	import { cn } from '#lib/utils.js';
	import { poster } from '#lib/format.js';

	let {
		path,
		title,
		size = 'w185',
		placeholder,
		eager = false,
		class: className = ''
	}: {
		path: string | null | undefined;
		title: string;
		size?: 'w92' | 'w185' | 'w342' | 'w500';
		/** A smaller size that's probably cached already (the list showed it), shown until `size` loads. */
		placeholder?: 'w92' | 'w185' | 'w342';
		/** For posters on screen when the page opens: fetch now, ahead of anything else. */
		eager?: boolean;
		class?: string;
	} = $props();

	let failed = $state(false);
	let loaded = $state(false);
	const src = $derived(failed ? null : poster(path, size));
	const low = $derived(placeholder && !loaded ? poster(path, placeholder) : null);
</script>

<div
	class={cn(
		'poster-img relative aspect-[2/3] shrink-0 overflow-hidden rounded-sm bg-muted',
		className
	)}
>
	{#if src}
		{#if low}
			<img src={low} alt="" decoding="async" class="absolute inset-0 size-full object-cover" />
		{/if}
		<img
			{src}
			alt=""
			loading={eager || placeholder ? 'eager' : 'lazy'}
			fetchpriority={eager || placeholder ? 'high' : 'auto'}
			decoding="async"
			class="relative size-full object-cover"
			onload={() => (loaded = true)}
			onerror={() => (failed = true)}
		/>
	{:else}
		<!-- No poster: set the title in type, like a plain programme card. -->
		<div class="flex size-full items-end p-[8%]">
			<span
				class="display [container-type:inline-size] line-clamp-4 text-[clamp(0.5rem,22cqw,1rem)] leading-tight text-muted-foreground"
			>
				{title}
			</span>
		</div>
	{/if}
</div>
