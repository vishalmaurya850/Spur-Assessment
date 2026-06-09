<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { sendMessage, fetchHistory, ChatClientError } from '$lib/api/chatClient';
	import type { ChatEntry, ChatMessageView } from '$lib/types';
	import MessageList from './MessageList.svelte';

	const SESSION_STORAGE_KEY = 'northwind-chat:sessionId';
	const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
	const MAX_INPUT_CHARS = 4000;

	let entries = $state<ChatEntry[]>([]);
	let sessionId = $state<string | undefined>(undefined);
	let draft = $state('');
	let inFlight = $state(false);
	let textarea = $state<HTMLTextAreaElement | null>(null);

	const trimmedLength = $derived(draft.trim().length);
	const canSend = $derived(trimmedLength > 0 && !inFlight);
	const nearLimit = $derived(draft.length > MAX_INPUT_CHARS - 200);

	function readStoredSessionId() {
		if (!browser) return undefined;
		try {
			return localStorage.getItem(SESSION_STORAGE_KEY) ?? undefined;
		} catch {
			return undefined;
		}
	}

	function storeSessionId(id: string) {
		if (!browser) return;
		try {
			localStorage.setItem(SESSION_STORAGE_KEY, id);
		} catch {
			// Storage may be unavailable (private mode, quota) — non-fatal.
		}
	}

	function appendMessage(message: ChatMessageView) {
		entries = [...entries, { kind: 'message', message }];
	}

	function appendSystem(text: string) {
		entries = [...entries, { kind: 'system', id: `system-${crypto.randomUUID()}`, text }];
	}

	function localUserMessage(text: string): ChatMessageView {
		return {
			id: `local-${crypto.randomUUID()}`,
			sender: 'user',
			text,
			timestamp: new Date().toISOString()
		};
	}

	function messageFromError(error: unknown) {
		if (error instanceof ChatClientError) {
			return error.message;
		}
		return GENERIC_ERROR_MESSAGE;
	}

	async function rehydrateHistory(id: string) {
		try {
			const history = await fetchHistory(id);
			entries = history.messages.map((message) => ({ kind: 'message', message }));
			sessionId = history.sessionId;
		} catch (error) {
			entries = [];
			appendSystem(messageFromError(error));
		}
	}

	function resizeTextarea() {
		if (!textarea) return;
		textarea.style.height = 'auto';
		textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
	}

	async function submit() {
		const text = draft.trim();
		if (text.length === 0 || inFlight) {
			return;
		}

		appendMessage(localUserMessage(text));
		draft = '';
		inFlight = true;
		await tick();
		resizeTextarea();

		try {
			const response = await sendMessage(text, sessionId);
			sessionId = response.sessionId;
			storeSessionId(response.sessionId);
			appendMessage({
				id: `ai-${crypto.randomUUID()}`,
				sender: 'ai',
				text: response.reply,
				timestamp: new Date().toISOString()
			});
		} catch (error) {
			appendSystem(messageFromError(error));
		} finally {
			inFlight = false;
		}
	}

	function applySuggestion(text: string) {
		draft = text;
		void submit();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			void submit();
		}
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		void submit();
	}

	onMount(() => {
		const stored = readStoredSessionId();
		if (stored) {
			sessionId = stored;
			void rehydrateHistory(stored);
		}
	});
</script>

<div class="app">
	<header class="nav">
		<div class="nav-inner">
			<div class="brand">
				<div class="brand-mark" aria-hidden="true">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
						<path
							d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z"
							fill="currentColor"
						/>
					</svg>
				</div>
				<div class="brand-text">
					<span class="brand-name">Northwind</span>
					<span class="brand-sub">Support Agent</span>
				</div>
			</div>
			<span class="status" data-testid="online-pill">
				<span class="status-dot" aria-hidden="true"></span>
				Online
			</span>
		</div>
	</header>

	<main class="conversation">
		<MessageList {entries} isTyping={inFlight} onsuggestion={applySuggestion} />
	</main>

	<footer class="composer-wrap">
		<form class="composer" onsubmit={handleSubmit}>
			<textarea
				class="input"
				bind:this={textarea}
				bind:value={draft}
				oninput={resizeTextarea}
				onkeydown={handleKeydown}
				rows="1"
				maxlength={MAX_INPUT_CHARS}
				placeholder="Message Northwind Support…"
				aria-label="Message"
				data-testid="chat-input"
			></textarea>
			<button
				type="submit"
				class="send"
				disabled={!canSend}
				aria-label="Send message"
				data-testid="send-button"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
					<path
						d="M5 12h14M13 6l6 6-6 6"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
		</form>
		<p class="hint" class:warn={nearLimit}>
			{#if nearLimit}
				{MAX_INPUT_CHARS - draft.length} characters left
			{:else}
				Press Enter to send · Shift + Enter for a new line
			{/if}
		</p>
	</footer>
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		height: 100vh;
		height: 100dvh;
		background: var(--bg);
	}

	/* Top navigation */
	.nav {
		flex: 0 0 auto;
		height: var(--nav-height);
		background: rgba(255, 255, 255, 0.8);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-bottom: 1px solid var(--border);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.nav-inner {
		height: 100%;
		max-width: var(--conversation-width);
		margin: 0 auto;
		padding: 0 var(--space-6);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.brand-mark {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-panel);
		background: var(--primary);
		color: #ffffff;
		display: grid;
		place-items: center;
	}

	.brand-text {
		display: flex;
		flex-direction: column;
		line-height: 1.1;
	}

	.brand-name {
		font-family: var(--font-display);
		font-size: var(--text-body);
		font-weight: 600;
		letter-spacing: -0.02em;
		color: var(--text-primary);
	}

	.brand-sub {
		font-size: var(--text-caption);
		color: var(--neutral);
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-small);
		font-weight: 500;
		color: var(--text-secondary);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		background: var(--success);
		box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.16);
	}

	/* Conversation area */
	.conversation {
		flex: 1 1 auto;
		min-height: 0;
		display: flex;
	}

	/* Composer */
	.composer-wrap {
		flex: 0 0 auto;
		padding: var(--space-3) var(--space-6) var(--space-5);
		background: linear-gradient(to top, var(--bg) 60%, rgba(250, 250, 250, 0));
	}

	.composer {
		max-width: var(--conversation-width);
		margin: 0 auto;
		display: flex;
		align-items: flex-end;
		gap: var(--space-2);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-card);
		padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
		transition:
			border-color 200ms ease,
			box-shadow 200ms ease;
	}

	.composer:focus-within {
		border-color: var(--primary);
		box-shadow: var(--ring-focus);
	}

	.input {
		flex: 1 1 auto;
		min-width: 0;
		resize: none;
		border: none;
		outline: none;
		background: transparent;
		font-family: var(--font-body);
		font-size: var(--text-body);
		line-height: 1.6;
		color: var(--text-primary);
		padding: var(--space-2) 0;
		max-height: 200px;
	}

	.input::placeholder {
		color: var(--neutral);
	}

	.send {
		flex: 0 0 auto;
		width: 38px;
		height: 38px;
		display: grid;
		place-items: center;
		border: none;
		border-radius: var(--radius-control);
		background: var(--primary);
		color: #ffffff;
		cursor: pointer;
		transition:
			background 200ms ease,
			transform 200ms ease,
			box-shadow 200ms ease,
			opacity 200ms ease;
	}

	.send:hover:not(:disabled) {
		background: var(--primary-hover);
		transform: translateY(-1px);
		box-shadow: var(--shadow-primary);
	}

	.send:focus-visible {
		outline: none;
		box-shadow: var(--ring-focus);
	}

	.send:disabled {
		background: var(--surface-alt);
		color: var(--neutral);
		cursor: not-allowed;
	}

	.hint {
		max-width: var(--conversation-width);
		margin: var(--space-2) auto 0;
		text-align: center;
		font-size: var(--text-caption);
		color: var(--neutral);
	}

	.hint.warn {
		color: var(--warning);
	}

	@media (max-width: 640px) {
		.composer-wrap {
			padding: var(--space-2) var(--space-3) var(--space-4);
		}

		.nav-inner {
			padding: 0 var(--space-4);
		}
	}
</style>
