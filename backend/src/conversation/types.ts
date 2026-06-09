/**
 * Channel-agnostic domain types for the conversation layer.
 *
 * Kept in a dedicated module so layers above the conversation service (e.g. the
 * validator) can produce/consume them without depending on the service
 * implementation itself.
 */

/**
 * Extensible set of inbound channels. The web chat widget is the only channel
 * implemented today; future channels (WhatsApp, Instagram) can be added here
 * without changing the Conversation entity contract.
 */
export type ChannelType = "web" | "whatsapp" | "instagram";

/**
 * A normalized, validated inbound message ready for the conversation service.
 *
 * Produced by the validator (`validateAndNormalize`): `text` is guaranteed to
 * be non-empty after trimming and bounded to the configured max length, and
 * `sessionId` is present only when it was a syntactically valid UUID.
 */
export interface InboundMessage {
  text: string;
  sessionId?: string;
  channel: ChannelType;
}

/**
 * A persisted conversation/session grouping messages.
 *
 * The `id` is a generated UUID that doubles as the client-facing `sessionId`.
 * This is the domain shape the data-access layer maps Prisma records onto: the
 * Prisma `Json` `metadata` column becomes a `Record<string, unknown>` (never
 * null, defaulting to `{}`) and the `DateTime` `createdAt` column becomes an
 * ISO 8601 string.
 */
export interface Conversation {
  /** Generated UUID v4, also used as the client `sessionId`. */
  id: string;
  /** Inbound channel; defaults to `"web"`. */
  channel: ChannelType;
  /** Creation timestamp as an ISO 8601 string. */
  createdAt: string;
  /** Arbitrary JSON metadata; never null (defaults to `{}`). */
  metadata: Record<string, unknown>;
}

/**
 * A single chat message in the shape returned to clients.
 *
 * Decoupled from the persisted domain {@link import("../data/types.js").Message}
 * shape: the conversation service maps a domain `Message` onto this view,
 * renaming `createdAt` to `timestamp` and dropping the internal
 * `conversationId`. `timestamp` is an ISO 8601 string.
 */
export interface ChatMessageView {
  /** UUID of the persisted message. */
  id: string;
  /** Who sent the message. */
  sender: "user" | "ai";
  /** The message text. */
  text: string;
  /** Creation timestamp as an ISO 8601 string (mapped from `createdAt`). */
  timestamp: string;
}

/**
 * The outcome of orchestrating a single chat turn.
 *
 * `degraded` is `true` when the LLM call failed and a non-empty degraded reply
 * was substituted. `sessionId` always equals the UUID of the conversation used
 * for the turn.
 */
export interface ChatTurnResult {
  /** The reply text (a real LLM reply, or a Degraded_Reply on failure). */
  reply: string;
  /** UUID of the Conversation used for this turn; also the client `sessionId`. */
  sessionId: string;
  /** `true` when a fallback Degraded_Reply was used instead of a real reply. */
  degraded: boolean;
}
