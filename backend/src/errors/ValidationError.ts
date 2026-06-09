/**
 * Typed error raised when an inbound request payload fails validation.
 *
 * The route layer maps this error to an HTTP 400 response with a user-safe
 * message. The message carried here is intended to be safe to surface to the
 * client: it never contains stack traces, secrets, or raw provider/database
 * payloads.
 */
export class ValidationError extends Error {
  /** Discriminant so callers can reliably identify this error type. */
  public readonly name = "ValidationError";

  constructor(message: string) {
    super(message);
    // Restore the prototype chain so `instanceof ValidationError` works when
    // compiled down to older targets / across module boundaries.
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Type guard for {@link ValidationError}.
 */
export function isValidationError(err: unknown): err is ValidationError {
  return err instanceof ValidationError;
}
