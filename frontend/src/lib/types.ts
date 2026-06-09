/**
 * Shared view types used by the chat widget and the client API module.
 *
 * These match the backend API contract so the frontend and backend agree on
 * response shapes.
 */

/** A single chat entry as rendered by the widget. */
export interface ChatMessageView {
	/** UUID of the persisted message. */
	id: string;
	/** Who authored the message. */
	sender: 'user' | 'ai';
	/** The message body. */
	text: string;
	/** ISO 8601 timestamp of when the message was created. */
	timestamp: string;
}

/** Response from `POST /chat/message`. */
export interface SendMessageResponse {
	/** The agent's reply text (always non-empty; may be a degraded fallback). */
	reply: string;
	/** UUID of the conversation used for this turn; persisted client-side. */
	sessionId: string;
}

/** Response from `GET /chat/:sessionId`. */
export interface HistoryResponse {
	/** UUID of the conversation. */
	sessionId: string;
	/** Persisted messages ordered oldest-first. Empty when no conversation exists. */
	messages: ChatMessageView[];
}

/**
 * A single rendered entry in the chat message list.
 *
 * The list interleaves persisted chat messages with inline system notices
 * (errors / degraded turns). A discriminated union keeps the two render paths
 * type-safe: `message` entries render as bubbles, `system` entries render as a
 * degraded banner strip.
 */
export type ChatEntry =
	| { kind: 'message'; message: ChatMessageView }
	| { kind: 'system'; id: string; text: string };
