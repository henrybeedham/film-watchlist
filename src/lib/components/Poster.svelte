<script lang="ts">
	import { cn } from '#lib/utils.js';
	import { poster } from '#lib/format.js';

	let {
		path,
		title,
		size = 'w185',
		class: className = ''
	}: {
		path: string | null | undefined;
		title: string;
		size?: 'w92' | 'w185' | 'w342' | 'w500';
		class?: string;
	} = $props();

	let failed = $state(false);
	const src = $derived(failed ? null : poster(path, size));
</script>

<div
	class={cn(
		'poster-img relative aspect-[2/3] shrink-0 overflow-hidden rounded-sm bg-muted',
		className
	)}
>
	{#if src}
		<img
			{src}
			alt=""
			loading="lazy"
			decoding="async"
			class="size-full object-cover"
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
