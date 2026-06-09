/**
 * Provider-error translation.
 *
 * `mapProviderError` converts ANY thrown value from a provider call into a
 * typed {@link LLMError} carrying a FIXED, user-safe message. The detector
 * helpers (`isTimeout`, `isAuthError`, `isRateLimit`, `isNetworkError`) inspect
 * the *shape* of an unknown error (status codes, error codes, names) without
 * reading, copying, or re-exposing any message text, payload, or secret.
 *
 * Security: the messages below are static literals. They contain no provider
 * name, raw provider payload, HTTP status detail, internal diagnostics, or
 * secrets. The original error is never wrapped as a `cause`, so vendor
 * internals cannot leak through the returned error.
 */
import { LLMError } from "../errors/LLMError.js";

/**
 * Narrow an unknown value to a plain record so we can safely probe properties
 * without throwing on `null`/primitives.
 */
function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

/**
 * Best-effort numeric HTTP status extractor. Vendor SDKs expose the status on
 * `status` or `statusCode` (sometimes nested under `response`). Only the numeric
 * shape is read — never any message/body text.
 */
function getStatus(err: Record<string, unknown>): number | undefined {
  const direct = err["status"] ?? err["statusCode"];
  if (typeof direct === "number") {
    return direct;
  }
  const response = asRecord(err["response"]);
  if (response) {
    const nested = response["status"] ?? response["statusCode"];
    if (typeof nested === "number") {
      return nested;
    }
  }
  return undefined;
}

/**
 * Lowercased string `code` if present, else undefined. Reads only the short,
 * non-sensitive machine code (e.g. `"econnreset"`, `"etimedout"`), never a
 * human-readable message or payload.
 */
function getCode(err: Record<string, unknown>): string | undefined {
  const code = err["code"];
  return typeof code === "string" ? code.toLowerCase() : undefined;
}

/** Lowercased constructor/`name` of the error, if present. */
function getName(err: Record<string, unknown>): string | undefined {
  const name = err["name"];
  return typeof name === "string" ? name.toLowerCase() : undefined;
}

/**
 * Detects a request timeout / abort.
 *
 * Recognizes Node/undici/fetch abort and timeout shapes (`AbortError`,
 * `TimeoutError`, `ETIMEDOUT`, `ESOCKETTIMEDOUT`) and HTTP 408 ("Request
 * Timeout") without inspecting message text.
 */
export function isTimeout(err: unknown): boolean {
  const record = asRecord(err);
  if (!record) {
    return false;
  }
  const name = getName(record);
  if (name === "aborterror" || name === "timeouterror") {
    return true;
  }
  const code = getCode(record);
  if (code === "etimedout" || code === "esockettimedout" || code === "econnaborted") {
    return true;
  }
  return getStatus(record) === 408;
}

/**
 * Detects an authentication/authorization failure (e.g. invalid or missing
 * key). Recognizes HTTP 401/403 without inspecting message text.
 */
export function isAuthError(err: unknown): boolean {
  const record = asRecord(err);
  if (!record) {
    return false;
  }
  const status = getStatus(record);
  return status === 401 || status === 403;
}

/**
 * Detects provider throttling. Recognizes HTTP 429 without inspecting message
 * text.
 */
export function isRateLimit(err: unknown): boolean {
  const record = asRecord(err);
  if (!record) {
    return false;
  }
  return getStatus(record) === 429;
}

/**
 * Detects a network-reachability failure (could not reach the provider).
 *
 * Recognizes common Node connection error codes (`ECONNREFUSED`, `ECONNRESET`,
 * `ENOTFOUND`, `EAI_AGAIN`, `ENETUNREACH`, `EPIPE`) and undici/fetch
 * connection-failure names without inspecting message text.
 */
export function isNetworkError(err: unknown): boolean {
  const record = asRecord(err);
  if (!record) {
    return false;
  }
  const code = getCode(record);
  if (
    code === "econnrefused" ||
    code === "econnreset" ||
    code === "enotfound" ||
    code === "eai_again" ||
    code === "enetunreach" ||
    code === "ehostunreach" ||
    code === "epipe"
  ) {
    return true;
  }
  const name = getName(record);
  return name === "fetcherror" || name === "connecterror";
}

/**
 * Translate any thrown provider value into a typed, user-safe {@link LLMError}.
 *
 * Preconditions: `err` is any thrown value from the provider call.
 * Postconditions: always returns an `LLMError` with a fixed user-safe message;
 * never re-exposes vendor internals, payloads, status detail, or secrets.
 */
export function mapProviderError(err: unknown): LLMError {
  if (isTimeout(err)) {
    return new LLMError("timeout", "The agent took too long to respond.");
  }
  if (isAuthError(err)) {
    return new LLMError("auth", "The assistant is temporarily unavailable.");
  }
  if (isRateLimit(err)) {
    return new LLMError("rate_limit", "We're a bit busy right now, please retry shortly.");
  }
  if (isNetworkError(err)) {
    return new LLMError("network", "Could not reach the assistant. Please try again.");
  }
  return new LLMError("unknown", "Something went wrong. Please try again.");
}
