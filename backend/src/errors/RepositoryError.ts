/**
 * Typed error raised by the data-access layer when a write is rejected.
 *
 * The repositories validate writes before touching the database and reject
 * invalid operations with a `RepositoryError` rather than persisting bad data.
 * No message/conversation is ever persisted when this error is raised.
 *
 * The route layer maps unexpected data-layer failures to a fixed generic HTTP
 * 500 message; the `message` carried here is a short, user-safe description
 * that excludes stack traces, secrets, and raw database details. The structured
 * `code` is an internal, non-sensitive discriminant intended for
 * branching/logging.
 */

/**
 * The set of data-layer rejection categories the repositories recognize.
 *
 * - `invalid_sender`           — a message write specified a `sender` value
 *                                other than `user` or `ai`.
 * - `conversation_not_found`   — a message write referenced a `conversationId`
 *                                that does not exist.
 */
export type RepositoryErrorCode = "invalid_sender" | "conversation_not_found";

export class RepositoryError extends Error {
  /** Discriminant so callers can reliably identify this error type. */
  public readonly name = "RepositoryError";

  /**
   * Internal, non-sensitive rejection category. Safe to log; never contains
   * secrets or raw database details.
   */
  public readonly code: RepositoryErrorCode;

  /**
   * @param code    The structured, internal rejection category.
   * @param message A short, user-safe description that excludes secrets,
   *                stack traces, and raw database details.
   */
  constructor(code: RepositoryErrorCode, message: string) {
    super(message);
    this.code = code;
    // Restore the prototype chain so `instanceof RepositoryError` works when
    // compiled down to older targets / across module boundaries.
    Object.setPrototypeOf(this, RepositoryError.prototype);
  }
}

/**
 * Type guard for {@link RepositoryError}.
 */
export function isRepositoryError(err: unknown): err is RepositoryError {
  return err instanceof RepositoryError;
}
