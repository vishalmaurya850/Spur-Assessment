/**
 * Express router factory for the chat API.
 *
 * Wires the {@link ChatController} handlers onto an Express {@link Router} and
 * attaches the centralized {@link chatErrorHandler} so every route shares one
 * error-to-status mapping with no leakage of internals.
 *
 * This is a pure factory: it accepts its collaborators by injection and
 * constructs no application singletons (no config load, no repositories, no
 * provider selection).
 *
 * Routes:
 * - `POST /chat/message`     → `ChatController.postMessage`
 * - `GET  /chat/:sessionId`  → `ChatController.getHistory`
 * - `GET  /health`           → `ChatController.getHealth`
 */
import express, { Router } from "express";
import type { ConversationService } from "../conversation/conversationService.js";
import { ChatController, chatErrorHandler } from "./chatController.js";
import { createCorsMiddleware } from "./corsMiddleware.js";

/**
 * Build an Express {@link Router} exposing the chat API.
 *
 * @param service         The conversation orchestrator the controller delegates
 *                        to (injected, not constructed here).
 * @param maxMessageChars Configured max message length forwarded to the
 *                        validator for truncation.
 * @param allowedOrigins  CORS allow-list; empty means reflect any origin.
 * @returns A router with CORS, JSON body parsing, the three chat routes, and
 *          the centralized error handler mounted last.
 */
export function createChatRouter(
  service: ConversationService,
  maxMessageChars: number,
  allowedOrigins: readonly string[] = [],
): Router {
  const controller = new ChatController(service, maxMessageChars);
  const router = Router();

  // CORS first so preflight OPTIONS requests and cross-origin responses get the
  // required Access-Control-* headers before any other handling.
  router.use(createCorsMiddleware(allowedOrigins));

  // Parse JSON request bodies. A malformed JSON payload surfaces as an error
  // forwarded to `chatErrorHandler`, which returns a user-safe response rather
  // than leaking parser internals.
  router.use(express.json());

  router.post("/chat/message", controller.postMessage);
  router.get("/chat/:sessionId", controller.getHistory);
  router.get("/health", controller.getHealth);

  // Centralized error handler MUST be registered after the routes so it can
  // catch errors forwarded via `next(err)`.
  router.use(chatErrorHandler);

  return router;
}
