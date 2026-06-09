/**
 * Shared `PrismaClient` singleton.
 *
 * The entire application talks to Neon serverless PostgreSQL through a single
 * `PrismaClient` instance. Prisma Client owns its own connection pool and
 * connection lifecycle, so creating more than one instance would open redundant
 * pools and risk exhausting Neon's connection limit. This module guarantees one
 * lazily-instantiated client is created on first use and reused everywhere.
 *
 * Usage:
 *
 *   import { getPrismaClient } from "../data/prismaClient.js";
 *   const prisma = getPrismaClient();
 *   await prisma.conversation.findUnique({ where: { id } });
 *
 * The client reads its connection string from `DATABASE_URL` (the Neon pooled
 * runtime endpoint) via the generated datasource config in `schema.prisma`. No
 * connection string is passed or logged here, so no secret is exposed by this
 * module.
 *
 * Lazy instantiation matters because importing this module must not require a
 * live database or a populated environment — the client connects on the first
 * query, not at construction time.
 */
import { PrismaClient } from "@prisma/client";

/**
 * Holds the process-wide singleton once created. In development, module reloads
 * (e.g. `tsx watch`) can re-evaluate this file; stashing the instance on
 * `globalThis` ensures hot reloads reuse the same client instead of leaking a
 * new connection pool on every reload.
 */
const globalForPrisma = globalThis as unknown as {
  __aiChatPrisma__?: PrismaClient;
};

/**
 * Returns the shared `PrismaClient`, creating it on first call.
 *
 * Every caller receives the same instance, so the underlying connection pool is
 * shared across all repositories and requests.
 */
export function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.__aiChatPrisma__) {
    globalForPrisma.__aiChatPrisma__ = new PrismaClient();
  }
  return globalForPrisma.__aiChatPrisma__;
}

/**
 * Disconnects and clears the shared client, releasing its connection pool.
 *
 * Intended for graceful shutdown. Safe to call when no client exists.
 */
export async function disconnectPrismaClient(): Promise<void> {
  const existing = globalForPrisma.__aiChatPrisma__;
  if (existing) {
    await existing.$disconnect();
    delete globalForPrisma.__aiChatPrisma__;
  }
}
