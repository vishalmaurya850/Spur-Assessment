<script lang="ts">
	import type { ChatMessageView } from '$lib/types';

	let { message }: { message: ChatMessageView } = $props();

	const isUser = $derived(message.sender === 'user');

	const formattedTime = $derived.by(() => {
		const date = new Date(message.timestamp);
		if (Number.isNaN(date.getTime())) {
			return '';
		}
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	});
</script>

<article class="row" class:user={isUser} class:ai={!isUser}>
	{#if !isUser}
		<div class="avatar ai-avatar" aria-hidden="true">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
				<path
					d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z"
					fill="currentColor"
				/>
			</svg>
		</div>
	{/if}

	<div class="stack">
		<div class="meta">
			<span class="author">{isUser ? 'You' : 'Northwind Agent'}</span>
			{#if formattedTime}
				<span class="time">{formattedTime}</span>
			{/if}
		</div>
		<div class="bubble" class:bubble-user={isUser} class:bubble-ai={!isUser}>
			{message.text}
		</div>
	</div>

	{#if isUser}
		<div class="avatar user-avatar" aria-hidden="true">You</div>
	{/if}
</article>

<style>
	.row {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
		width: 100%;
	}

	.row.user {
		flex-direction: row-reverse;
	}

	.avatar {
		flex: 0 0 auto;
		width: 30px;
		height: 30px;
		border-radius: var(--radius-full);
		display: grid;
		place-items: center;
		margin-top: 22px;
	}

	.ai-avatar {
		background: var(--primary);
		color: #ffffff;
	}

	.user-avatar {
		background: var(--surface-alt);
		color: var(--text-secondary);
		border: 1px solid var(--border);
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.stack {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		min-width: 0;
		max-width: 84%;
	}

	.row.user .stack {
		align-items: flex-end;
	}

	.meta {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		padding: 0 var(--space-1);
	}

	.author {
		font-family: var(--font-display);
		font-size: var(--text-small);
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--text-primary);
	}

	.time {
		font-size: var(--text-caption);
		color: var(--neutral);
	}

	.bubble {
		font-family: var(--font-body);
		font-size: var(--text-body);
		line-height: 1.65;
		white-space: pre-wrap;
		word-break: break-word;
		overflow-wrap: anywhere;
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-card);
	}

	.bubble-ai {
		background: var(--surface);
		color: var(--text-primary);
		border: 1px solid var(--border);
		border-top-left-radius: var(--radius-chip);
	}

	.bubble-user {
		background: var(--primary);
		color: #ffffff;
		border-top-right-radius: var(--radius-chip);
	}
</style>
