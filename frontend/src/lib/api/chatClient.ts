/**
 * ChatClient API module.
 *
 * Thin, typed wrapper around the backend chat endpoints:
 *   - `sendMessage(message, sessionId?)` → POST {base}/chat/message
 *   - `fetchHistory(sessionId)`          → GET  {base}/chat/:sessionId
 *
 * On any non-ok HTTP response or network/fetch failure, the client throws a
 * {@link ChatClientError} carrying a friendly, user-safe message that the
 * widget can render inline as a system message. Raw payloads, stack traces,
 * and provider/DB internals are never surfaced to the caller.
 */

import type { SendMessageResponse, HistoryResponse } from '$lib/types';

/**
 * The backend base URL. Configurable via the `VITE_API_BASE_URL` env var
 * (e.g. in `.env`), falling back to the local dev backend.
 */
const DEFAULT_API_BASE_URL = 'http://localhost:3000';

function resolveBaseUrl(): string {
	const configured =
		typeof import.meta.env?.VITE_API_BASE_URL === 'string'
			? import.meta.env.VITE_API_BASE_URL.trim()
			: '';
	const base = configured.length > 0 ? configured : DEFAULT_API_BASE_URL;
	// Strip any trailing slash so path joining stays predictable.
	return base.replace(/\/+$/, '');
}

/** Friendly fallback messages shown inline when a request cannot complete. */
const NETWORK_ERROR_MESSAGE =
	'Could not reach the assistant. Please check your connection and try again.';
const HTTP_ERROR_MESSAGE = 'Something went wrong. Please try again.';
const PARSE_ERROR_MESSAGE = 'Received an unexpected response. Please try again.';

/**
 * A typed, user-safe error thrown by {@link ChatClient} operations.
 *
 * Its `message` is always safe to display inline in the widget — it never
 * contains stack traces, secrets, or raw provider/backend payloads. The
 * optional `status` records the HTTP status code (absent for network errors).
 */
export class ChatClientError extends Error {
	/** HTTP status code when the failure was an HTTP error; undefined for network errors. */
	readonly status?: number;

	constructor(message: string, status?: number) {
		super(message);
		this.name = 'ChatClientError';
		this.status = status;
		// Restore prototype chain for instanceof checks across transpilation targets.
		Object.setPrototypeOf(this, ChatClientError.prototype);
	}
}

/**
 * Extract a friendly message from a backend error response without leaking
 * internals. The backend sends `{ error: "friendly message" }`; we only trust
 * a short string and otherwise fall back to a generic message.
 */
function friendlyMessageFromBody(body: unknown): string {
	if (
		body !== null &&
		typeof body === 'object' &&
		'error' in body &&
		typeof (body as { error: unknown }).error === 'string'
	) {
		const message = (body as { error: string }).error.trim();
		// Guard against oversized or empty payloads being shown verbatim.
		if (message.length > 0 && message.length <= 300) {
			return message;
		}
	}
	return HTTP_ERROR_MESSAGE;
}

/** Perform a fetch, translating network failures into a ChatClientError. */
async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
	try {
		return await fetch(url, init);
	} catch {
		// Network error / fetch rejection — never expose the raw cause.
		throw new ChatClientError(NETWORK_ERROR_MESSAGE);
	}
}

/**
 * Parse a successful (`res.ok`) JSON response, or throw a friendly
 * ChatClientError carrying the backend message on a non-ok status.
 */
async function parseJsonOrThrow<T>(res: Response): Promise<T> {
	if (!res.ok) {
		let body: unknown = undefined;
		try {
			body = await res.json();
		} catch {
			// Non-JSON error body — fall through to the generic message.
		}
		throw new ChatClientError(friendlyMessageFromBody(body), res.status);
	}

	try {
		return (await res.json()) as T;
	} catch {
		throw new ChatClientError(PARSE_ERROR_MESSAGE, res.status);
	}
}

/**
 * Send a user message to the backend and return the agent's reply.
 *
 * @param message   The user's message text.
 * @param sessionId Optional existing conversation id to continue.
 * @returns The typed `{ reply, sessionId }` response.
 * @throws {ChatClientError} On a non-ok HTTP response or a network failure.
 */
export async function sendMessage(
	message: string,
	sessionId?: string
): Promise<SendMessageResponse> {
	const body: { message: string; sessionId?: string } = { message };
	if (sessionId !== undefined) {
		body.sessionId = sessionId;
	}

	const res = await safeFetch(`${resolveBaseUrl()}/chat/message`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	return parseJsonOrThrow<SendMessageResponse>(res);
}

/**
 * Fetch the persisted conversation history for a session.
 *
 * @param sessionId The conversation id to load history for.
 * @returns The typed `{ sessionId, messages }` response (messages oldest-first).
 * @throws {ChatClientError} On a non-ok HTTP response or a network failure.
 */
export async function fetchHistory(sessionId: string): Promise<HistoryResponse> {
	const res = await safeFetch(
		`${resolveBaseUrl()}/chat/${encodeURIComponent(sessionId)}`,
		{ method: 'GET' }
	);

	return parseJsonOrThrow<HistoryResponse>(res);
}
