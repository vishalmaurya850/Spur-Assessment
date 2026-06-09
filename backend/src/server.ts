/**
 * Composition root for the AI Live Chat Agent backend.
 *
 * Assembles the application's object graph from a validated {@link AppConfig}:
 * it selects the LLM provider, constructs the knowledge base, the
 * vendor-neutral LLM service, the Prisma-backed repositories, and the
 * conversation service, then mounts the chat router on a fresh Express app.
 *
 * Two responsibilities are deliberately kept separate:
 * - {@link buildApp} builds and returns a fully-wired Express `Application`
 *   WITHOUT calling `listen`, so it can be imported and driven directly.
 * - {@link startServer} performs the runtime bootstrap: load + validate config
 *   (fail-fast), build the app, begin listening on the configured port only
 *   after successful validation, and register graceful shutdown handlers.
 *
 * Note: the API is intentionally unauthenticated — authentication is out of
 * scope for this exercise. No auth middleware is mounted. Secrets (API keys,
 * connection strings) are sourced only from the validated config and never
 * logged.
 */
import express, { type Application } from "express";
import type { Server } from "node:http";
import type { AppConfig } from "./config/index.js";
import { loadConfig } from "./config/index.js";
import { ConfigError } from "./errors/ConfigError.js";
import { StaticKnowledgeBase } from "./knowledge/knowledgeBase.js";
import { OpenAIProvider } from "./llm/openAIProvider.js";
import { AnthropicProvider } from "./llm/anthropicProvider.js";
import type { LLMProvider } from "./llm/types.js";
import { DefaultLLMService } from "./llm/llmService.js";
import { PrismaConversationRepository } from "./data/conversationRepository.js";
import { PrismaMessageRepository } from "./data/messageRepository.js";
import { disconnectPrismaClient } from "./data/prismaClient.js";
import { DefaultConversationService } from "./conversation/conversationService.js";
import { createChatRouter } from "./routes/chatRouter.js";

/**
 * Select the concrete {@link LLMProvider} for the configured vendor. The
 * matching API key and model come from the validated config; this function
 * never reads `process.env` directly so it stays driven entirely by validated
 * configuration.
 */
function createProvider(config: AppConfig): LLMProvider {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(config.apiKey, config.model);
    case "openai":
      return new OpenAIProvider(config.apiKey, config.model);
    default: {
      // Exhaustiveness guard: `provider` is a closed union, so this is
      // unreachable unless a new provider is added without handling it here.
      const exhaustive: never = config.provider;
      throw new Error(`Unsupported LLM provider: ${String(exhaustive)}`);
    }
  }
}

/**
 * Build and return a fully-wired Express application from a validated config.
 *
 * Constructs the full dependency graph (provider → LLM service, repositories →
 * conversation service) and mounts the chat router at the app root, exposing
 * `POST /chat/message`, `GET /chat/:sessionId`, and `GET /health`.
 *
 * Does NOT call `listen`, so it is safe to import elsewhere. The caller (or
 * {@link startServer}) is responsible for binding a port.
 *
 * @param config A fully validated {@link AppConfig}.
 * @returns The configured Express {@link Application}.
 */
export function buildApp(config: AppConfig): Application {
  const provider = createProvider(config);
  const knowledgeBase = new StaticKnowledgeBase();

  const llmService = new DefaultLLMService(provider, knowledgeBase, {
    maxHistoryMessages: config.maxHistoryMessages,
    maxReplyTokens: config.maxReplyTokens,
    llmTimeoutMs: config.llmTimeoutMs,
  });

  const conversationRepo = new PrismaConversationRepository();
  const messageRepo = new PrismaMessageRepository();

  const conversationService = new DefaultConversationService(
    conversationRepo,
    messageRepo,
    llmService,
    config.maxHistoryMessages,
  );

  const app = express();

  // The chat router owns JSON body parsing and the centralized error handler.
  // Mounted at the root so its paths (/chat/message, /chat/:sessionId, /health)
  // resolve as designed. Note: no authentication middleware is mounted — the
  // API is intentionally unauthenticated for this exercise.
  app.use(createChatRouter(conversationService, config.maxMessageChars, config.allowedOrigins));

  return app;
}

/**
 * Register graceful-shutdown handlers that close the HTTP server and release
 * the shared Prisma connection pool on `SIGINT`/`SIGTERM`.
 *
 * Exported so it can be invoked/tested in isolation. Idempotent guarding via a
 * flag prevents double-shutdown if both signals fire.
 */
export function registerGracefulShutdown(server: Server): void {
  let shuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    // eslint-disable-next-line no-console
    console.log(`Received ${signal}, shutting down gracefully...`);

    server.close((closeErr) => {
      void (async () => {
        try {
          await disconnectPrismaClient();
        } catch (disconnectErr) {
          // eslint-disable-next-line no-console
          console.error(
            "Error while disconnecting the database client during shutdown:",
            disconnectErr instanceof Error
              ? disconnectErr.message
              : disconnectErr,
          );
        }
        process.exit(closeErr ? 1 : 0);
      })();
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

/**
 * Runtime bootstrap: validate config (fail-fast), build the app, and listen.
 *
 * Order:
 * 1. `loadConfig()` validates every required environment variable. On a
 *    {@link ConfigError}, log a safe message naming the offending variable
 *    WITHOUT its value and exit non-zero. The server NEVER begins listening.
 * 2. Only after successful validation do we build dependencies and bind the
 *    configured `PORT`.
 * 3. Register graceful shutdown so the Prisma pool is released on exit.
 *
 * @returns The listening {@link Server}, or `undefined` if startup aborted.
 */
export function startServer(): Server | undefined {
  let config: AppConfig;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      // Safe-by-construction: ConfigError carries the variable NAME only, never
      // its value, so this is safe to log during startup.
      // eslint-disable-next-line no-console
      console.error(`Configuration error: ${err.message}`);
    } else {
      // eslint-disable-next-line no-console
      console.error(
        "Fatal error during startup:",
        err instanceof Error ? err.message : err,
      );
    }
    // Abort startup without listening.
    process.exitCode = 1;
    return undefined;
  }

  const app = buildApp(config);

  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(
      `AI Live Chat Agent backend listening on port ${config.port} ` +
        `(provider: ${config.provider}).`,
    );
  });

  registerGracefulShutdown(server);

  return server;
}
