/**
 * Minimal, dependency-free CORS middleware for the chat API.
 *
 * Browsers enforce the same-origin policy and send a preflight `OPTIONS`
 * request for cross-origin POSTs that carry a JSON `Content-Type`. Without the
 * matching `Access-Control-Allow-*` response headers the browser blocks the
 * call. This middleware emits those headers based on the configured allow-list
 * and short-circuits preflight requests with `204 No Content`.
 *
 * Origin handling:
 * - When `allowedOrigins` is empty, any origin is reflected back (open CORS).
 *   Convenient for local development and demos.
 * - Otherwise, the request `Origin` is echoed only when it appears in the
 *   allow-list; unknown origins receive no `Access-Control-Allow-Origin`
 *   header, so the browser blocks them.
 *
 * `Vary: Origin` is always set so caches don't serve a response generated for
 * one origin to another.
 */
import type { Request, Response, NextFunction, RequestHandler } from "express";

/** Methods the chat API exposes to browser clients. */
const ALLOWED_METHODS = "GET,POST,OPTIONS";
/** Request headers the browser is permitted to send. */
const ALLOWED_HEADERS = "Content-Type";
/** How long (seconds) the browser may cache the preflight result. */
const MAX_AGE_SECONDS = "86400";

/**
 * Build a CORS middleware bound to the configured allow-list.
 *
 * @param allowedOrigins Origins permitted to call the API. Empty = reflect any
 *                       origin. Entries must have no trailing slash so they
 *                       match the browser-sent `Origin` header exactly.
 */
export function createCorsMiddleware(
  allowedOrigins: readonly string[],
): RequestHandler {
  const allowAny = allowedOrigins.length === 0;
  const allowSet = new Set(allowedOrigins);

  return function corsMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const origin = req.headers.origin;

    res.setHeader("Vary", "Origin");

    if (typeof origin === "string" && (allowAny || allowSet.has(origin))) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
      res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
      res.setHeader("Access-Control-Max-Age", MAX_AGE_SECONDS);
    }

    // Short-circuit the preflight request: no body, just the headers above.
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  };
}
