<script lang="ts">
	import { tick } from 'svelte';
	import type { ChatEntry } from '$lib/types';
	import MessageBubble from './MessageBubble.svelte';
	import SystemBanner from './SystemBanner.svelte';
	import TypingIndicator from './TypingIndicator.svelte';

	let {
		entries,
		isTyping = false,
		onsuggestion
	}: {
		entries: ChatEntry[];
		isTyping?: boolean;
		onsuggestion?: (text: string) => void;
	} = $props();

	let viewport = $state<HTMLDivElement | null>(null);
	let atBottom = $state(true);

	const BOTTOM_THRESHOLD_PX = 32;

	const suggestions = [
		'What is your return policy?',
		'Do you ship internationally?',
		'When is support available?'
	];

	function computeAtBottom(el: HTMLDivElement) {
		return el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD_PX;
	}

	function handleScroll() {
		if (viewport) {
			atBottom = computeAtBottom(viewport);
		}
	}

	function scrollToLatest() {
		if (viewport) {
			viewport.scrollTop = viewport.scrollHeight;
			atBottom = true;
		}
	}

	const rowCount = $derived(entries.length + (isTyping ? 1 : 0));

	$effect(() => {
		void rowCount;
		if (atBottom) {
			tick().then(() => {
				if (viewport && atBottom) {
					viewport.scrollTop = viewport.scrollHeight;
				}
			});
		}
	});

	const isEmpty = $derived(entries.length === 0 && !isTyping);
</script>

<div class="list-wrap">
	<div
		class="viewport"
		bind:this={viewport}
		onscroll={handleScroll}
		data-testid="message-list"
		role="log"
		aria-live="polite"
		aria-label="Conversation messages"
	>
		{#if isEmpty}
			<div class="empty-state" data-testid="empty-state">
				<div class="empty-mark" aria-hidden="true">
					<svg width="28" height="28" viewBox="0 0 24 24" fill="none">
						<path
							d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z"
							fill="currentColor"
						/>
					</svg>
				</div>
				<h1 class="greeting">How can we help?</h1>
				<p class="empty-sub">
					Ask about orders, shipping, or returns — our agent answers in seconds.
				</p>
				<div class="suggestions">
					{#each suggestions as suggestion (suggestion)}
						<button type="button" class="chip" onclick={() => onsuggestion?.(suggestion)}>
							{suggestion}
						</button>
					{/each}
				</div>
			</div>
		{:else}
			<div class="column">
				<div class="entries">
					{#each entries as entry (entry.kind === 'message' ? entry.message.id : entry.id)}
						{#if entry.kind === 'message'}
							<MessageBubble message={entry.message} />
						{:else}
							<SystemBanner text={entry.text} />
						{/if}
					{/each}
					{#if isTyping}
						<TypingIndicator />
					{/if}
				</div>
			</div>
		{/if}
	</div>

	{#if !atBottom}
		<button
			type="button"
			class="jump-to-latest"
			onclick={scrollToLatest}
			data-testid="jump-to-latest"
			aria-label="Jump to latest message"
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
				<path
					d="M12 5v14M6 13l6 6 6-6"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
		</button>
	{/if}
</div>

<style>
	.list-wrap {
		position: relative;
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
	}

	.viewport {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		scroll-behavior: smooth;
	}

	.column {
		width: 100%;
		max-width: var(--conversation-width);
		margin: 0 auto;
		padding: var(--space-8) var(--space-6) var(--space-10);
	}

	.entries {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	/* Empty state */
	.empty-state {
		min-height: 100%;
		max-width: var(--conversation-width);
		margin: 0 auto;
		padding: var(--space-12) var(--space-6);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: var(--space-4);
	}

	.empty-mark {
		width: 56px;
		height: 56px;
		border-radius: var(--radius-card);
		background: var(--primary);
		color: #ffffff;
		display: grid;
		place-items: center;
		box-shadow: var(--shadow-primary);
	}

	.greeting {
		margin: var(--space-2) 0 0;
		font-family: var(--font-display);
		font-size: var(--text-section);
		font-weight: 700;
		letter-spacing: -0.03em;
		color: var(--text-primary);
	}

	.empty-sub {
		margin: 0;
		max-width: 420px;
		font-size: var(--text-body);
		color: var(--text-secondary);
	}

	.suggestions {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}

	.chip {
		font-family: var(--font-body);
		font-size: var(--text-small);
		color: var(--text-secondary);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		padding: var(--space-2) var(--space-4);
		cursor: pointer;
		transition:
			border-color 200ms ease,
			color 200ms ease,
			background 200ms ease,
			transform 200ms ease;
	}

	.chip:hover {
		border-color: var(--primary);
		color: var(--primary);
		transform: translateY(-1px);
	}

	.chip:focus-visible {
		outline: none;
		box-shadow: var(--ring-focus);
		border-color: var(--primary);
	}

	/* Jump to latest */
	.jump-to-latest {
		position: absolute;
		bottom: var(--space-5);
		left: 50%;
		transform: translateX(-50%);
		width: 36px;
		height: 36px;
		display: grid;
		place-items: center;
		background: var(--surface);
		color: var(--text-secondary);
		border: 1px solid var(--border);
		border-radius: var(--radius-full);
		cursor: pointer;
		box-shadow: var(--shadow-hover);
		transition:
			color 200ms ease,
			border-color 200ms ease,
			transform 200ms ease;
	}

	.jump-to-latest:hover {
		color: var(--primary);
		border-color: var(--primary);
		transform: translateX(-50%) translateY(-1px);
	}

	.jump-to-latest:focus-visible {
		outline: none;
		box-shadow: var(--ring-focus);
		border-color: var(--primary);
	}
</style>
