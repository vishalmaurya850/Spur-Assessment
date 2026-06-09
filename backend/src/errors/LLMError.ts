/**
 * Typed error raised when an LLM provider call fails.
 *
 * The LLM service translates any vendor/SDK failure (timeout, invalid key,
 * rate limit, network, or unknown) into an `LLMError` via `mapProviderError`
 * (see `errorMapping.ts`). The conversation service catches this error to
 * produce a non-empty degraded reply.
 *
 * Security: the `message` carried here is a FIXED, user-safe string. It MUST
 * NEVER contain the provider name, the raw provider payload, HTTP status
 * detail, stack traces, internal diagnostics, or any secret (such as an API
 * key). The structured `code` is an internal, non-sensitive discriminant
 * intended for logging/branching, not for display.
 */

/**
 * The set of provider-failure categories the service recognizes.
 *
 * - `timeout`    — the call did not complete within the configured timeout.
 * - `auth`       — the credential was rejected (e.g. HTTP 401 / invalid key).
 * - `rate_limit` — the provider throttled the request (e.g. HTTP 429).
 * - `network`    — the provider could not be reached (connection failure).
 * - `unknown`    — any other / unclassified failure.
 */
export type LLMErrorCode =
  | "timeout"
  | "auth"
  | "rate_limit"
  | "network"
  | "unknown";

export class LLMError extends Error {
  /** Discriminant so callers can reliably identify this error type. */
  public readonly name = "LLMError";

  /**
   * Internal, non-sensitive failure category. Safe to log; never contains
   * provider internals or secrets. Not intended to be shown to end users.
   */
  public readonly code: LLMErrorCode;

  /**
   * @param code    The structured, internal failure category.
   * @param message A fixed, user-safe message. Callers MUST pass only static
   *                strings that exclude provider names, raw payloads, status
   *                detail, and secrets.
   */
  constructor(code: LLMErrorCode, message: string) {
    super(message);
    this.code = code;
    // Restore the prototype chain so `instanceof LLMError` works when compiled
    // down to older targets / across module boundaries.
    Object.setPrototypeOf(this, LLMError.prototype);
  }
}

/**
 * Type guard for {@link LLMError}.
 */
export function isLLMError(err: unknown): err is LLMError {
  return err instanceof LLMError;
}
