/**
 * Chat controller (route layer).
 *
 * Translates between HTTP and the channel-agnostic {@link ConversationService}.
 * The controller is intentionally thin: it parses the request, delegates
 * validation to the injected validator, invokes the service, and shapes the
 * HTTP response. It owns NO domain logic and constructs none of its
 * dependencies — those are injected.
 *
 * Error handling is centralized: handlers forward any thrown error to Express's
 * `next(err)` so the single error-handling middleware
 * ({@link chatErrorHandler}) decides the status code and emits a user-safe
 * body. No handler ever writes a stack trace, secret, or raw provider/DB detail
 * to the response.
 *
 * Routes:
 * - `POST /chat/message` success → HTTP 200 `{ reply, sessionId }`.
 * - `GET /chat/:sessionId` (existing) → HTTP 200 `{ sessionId, messages[] }`.
 * - `GET /chat/:sessionId` (no match) → HTTP 200 with `messages: []`.
 * - `GET /health` → HTTP 200 `{ status: "ok" }`.
 * - `ValidationError` → HTTP 400 with a user-safe message; degraded turns still
 *   return 200; data-layer/unexpected failures → HTTP 500 with a fixed generic
 *   body. No response leaks stack traces, secrets, or raw payloads.
 */
import type { NextFunction, Request, Response } from "express";
import type { ConversationService } from "../conversation/conversationService.js";
import { validateAndNormalize } from "../validation/validateAndNormalize.js";
import { isValidationError } from "../errors/ValidationError.js";

/**
 * Fixed, user-safe error message returned for any unexpected/data-layer
 * failure. It is a static string so it can never embed a stack trace, secret,
 * provider name, or raw database detail.
 */
export const GENERIC_ERROR_MESSAGE =
  "Something went wrong. Please try again later.";

/**
 * HTTP controller wrapping a {@link ConversationService}.
 *
 * Handlers are exposed as bound arrow-function properties so they can be passed
 * directly to Express route registration without losing `this`.
 */
export class ChatController {
  private readonly service: ConversationService;
  private readonly maxMessageChars: number;

  /**
   * @param service         Channel-agnostic conversation orchestrator.
   * @param maxMessageChars Configured max message length passed to the
   *                        validator for truncation.
   */
  constructor(service: ConversationService, maxMessageChars: number) {
    this.service = service;
    this.maxMessageChars = maxMessageChars;
  }

  /**
   * `POST /chat/message` — validate the body, orchestrate one chat turn, and
   * return HTTP 200 `{ reply, sessionId }`.
   *
   * A degraded turn is a normal success from the HTTP perspective: the service
   * has already substituted a non-empty degraded reply, so this still returns
   * 200. Any thrown error — `ValidationError` or otherwise — is forwarded to
   * {@link chatErrorHandler} via `next` so status mapping and response safety
   * live in one place.
   */
  postMessage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const inbound = validateAndNormalize(req.body, this.maxMessageChars);
      const result = await this.service.handleMessage(inbound);
      res.status(200).json({
        reply: result.reply,
        sessionId: result.sessionId,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * `GET /chat/:sessionId` — return the persisted history as HTTP 200
   * `{ sessionId, messages }`. When the session resolves to no conversation,
   * the service yields an empty array and this returns 200 with `messages: []`.
   * Errors are forwarded to the centralized error handler.
   */
  getHistory = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      // Express always populates a matched `:sessionId` param; coalesce to ""
      // to satisfy `exactOptionalPropertyTypes` and pass a definite string.
      const sessionId = req.params.sessionId ?? "";
      const messages = await this.service.getHistory(sessionId);
      res.status(200).json({ sessionId, messages });
    } catch (err) {
      next(err);
    }
  };

  /**
   * `GET /health` — liveness probe returning HTTP 200 `{ status: "ok" }`.
   * Performs no I/O so it cannot fail under normal operation.
   */
  getHealth = (_req: Request, res: Response): void => {
    res.status(200).json({ status: "ok" });
  };
}

/**
 * Centralized Express error-handling middleware.
 *
 * Maps thrown errors to HTTP status codes while guaranteeing the response body
 * never leaks internals:
 * - {@link import("../errors/ValidationError.js").ValidationError} → HTTP 400
 *   with the error's already-user-safe message.
 * - Any other error (data-layer failure, unexpected bug) → HTTP 500 with the
 *   fixed {@link GENERIC_ERROR_MESSAGE}.
 *
 * The original error's message/stack is never copied into a 500 response, so
 * raw provider/DB details and stack traces cannot reach the client. The
 * four-argument signature is required for Express to recognize this as an
 * error handler; `next` is unused but must be present.
 */
export function chatErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // If headers were already sent, delegating to Express's default handler is
  // the only safe option; otherwise we shape a user-safe body ourselves.
  if (res.headersSent) {
    return;
  }

  if (isValidationError(err)) {
    res.status(400).json({ error: err.message });
    return;
  }

  // Data-layer failures and any unexpected error collapse to a single fixed,
  // generic message. We deliberately ignore `err`'s contents here so nothing
  // sensitive (stack trace, secret, raw provider/DB payload) can leak.
  res.status(500).json({ error: GENERIC_ERROR_MESSAGE });
}
