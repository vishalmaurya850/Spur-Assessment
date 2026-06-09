<script lang="ts">
	// Shown while a reply is in flight, positioned where the next AI message appears.
</script>

<div class="row" role="status" aria-live="polite" data-testid="typing-indicator">
	<div class="avatar" aria-hidden="true">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
			<path
				d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z"
				fill="currentColor"
			/>
		</svg>
	</div>
	<div class="bubble">
		<span class="sr">Agent is typing…</span>
		<span class="dot"></span>
		<span class="dot"></span>
		<span class="dot"></span>
	</div>
</div>

<style>
	.row {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}

	.avatar {
		flex: 0 0 auto;
		width: 30px;
		height: 30px;
		border-radius: var(--radius-full);
		background: var(--primary);
		color: #ffffff;
		display: grid;
		place-items: center;
	}

	.bubble {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-card);
		border-top-left-radius: var(--radius-chip);
		padding: var(--space-3) var(--space-4);
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: var(--radius-full);
		background: var(--neutral);
		animation: blink 1.4s ease-in-out infinite both;
	}

	.dot:nth-child(3) {
		animation-delay: 0.2s;
	}

	.dot:nth-child(4) {
		animation-delay: 0.4s;
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}

	@keyframes blink {
		0%,
		80%,
		100% {
			opacity: 0.25;
			transform: translateY(0);
		}
		40% {
			opacity: 1;
			transform: translateY(-2px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dot {
			animation: none;
			opacity: 0.6;
		}
	}
</style>
