/**
 * Input validation & normalization for inbound chat messages.
 *
 *   - Reject missing / non-string / empty-after-trim `message` with a typed
 *     {@link ValidationError} (→ HTTP 400).
 *   - Truncate an oversized `message` to the first `maxMessageChars` characters
 *     rather than rejecting it.
 *   - Accept `sessionId` only when it is a syntactically valid UUID; otherwise
 *     ignore it so the turn is treated as a new conversation.
 *
 * This function is intentionally pure: it reads nothing from the environment or
 * a config singleton. `maxMessageChars` is injected by the caller so the
 * validator stays trivially testable and free of side effects.
 */
import { ValidationError } from "../errors/ValidationError.js";
import type { InboundMessage } from "../conversation/types.js";

/**
 * Matches a canonical UUID (versions 1–5), case-insensitive, e.g.
 * `123e4567-e89b-12d3-a456-426614174000`.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @returns `true` if `value` is a syntactically valid UUID string.
 */
function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Narrowing guard for a non-null object (excludes arrays and `null`).
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validate and normalize a raw, untrusted request payload into an
 * {@link InboundMessage}.
 *
 * @param body            The raw request body (untrusted, `unknown`).
 * @param maxMessageChars The configured `MAX_MESSAGE_CHARS` cap. Messages
 *                        longer than this (after trimming) are truncated.
 * @returns A normalized `InboundMessage` with `channel: "web"`, non-empty
 *          length-bounded `text`, and an optional valid-UUID `sessionId`.
 * @throws {ValidationError} When `message` is missing, not a string, or empty
 *         after trimming.
 */
export function validateAndNormalize(
  body: unknown,
  maxMessageChars: number,
): InboundMessage {
  if (!isObject(body) || typeof body.message !== "string") {
    throw new ValidationError("Message is required.");
  }

  const trimmed = body.message.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Message cannot be empty.");
  }

  // Oversized input: truncate rather than reject, so the chat still works.
  let text = trimmed;
  if (text.length > maxMessageChars) {
    text = text.slice(0, maxMessageChars);
  }

  // Accept a forged/invalid sessionId silently by ignoring it: the turn is
  // then treated as a brand-new conversation rather than crashing.
  const sessionId =
    typeof body.sessionId === "string" && isUuid(body.sessionId)
      ? body.sessionId
      : undefined;

  return sessionId === undefined
    ? { text, channel: "web" }
    : { text, sessionId, channel: "web" };
}
