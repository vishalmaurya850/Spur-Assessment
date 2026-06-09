<script lang="ts">
	let { text }: { text: string } = $props();
</script>

<div class="banner" role="status">
	<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
		<path d="M12 8v5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
		<circle cx="12" cy="16.5" r="1.2" fill="currentColor" />
	</svg>
	<span>{text}</span>
</div>

<style>
	.banner {
		align-self: center;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		max-width: 100%;
		background: var(--error-tint);
		color: var(--error);
		border: 1px solid rgba(239, 68, 68, 0.2);
		font-family: var(--font-body);
		font-size: var(--text-small);
		line-height: 1.45;
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-panel);
	}

	.icon {
		flex: 0 0 auto;
	}
</style>
