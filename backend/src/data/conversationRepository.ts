/**
 * Conversation data-access layer.
 *
 * Owns all database reads/writes for conversations, talking to Neon serverless
 * PostgreSQL through the shared Prisma Client singleton. The repository keeps
 * the rest of the application decoupled from the ORM: callers work only with
 * the domain {@link Conversation} shape, while this module maps to/from Prisma
 * model records — translating the Prisma `Json` `metadata` field into a
 * `Record<string, unknown>` and the `DateTime` `createdAt` field into an ISO
 * 8601 string.
 *
 * All queries go through Prisma Client, which parameterizes every statement by
 * default; no hand-written SQL or string interpolation is used.
 */
import type { Prisma, Conversation as PrismaConversation } from "@prisma/client";
import { getPrismaClient } from "./prismaClient.js";
import type { ChannelType, Conversation } from "../conversation/types.js";

/**
 * Repository contract for {@link Conversation} persistence.
 *
 * The interface is intentionally ORM-agnostic so the backing implementation can
 * change (raw `pg`, Prisma, etc.) without touching callers.
 */
export interface ConversationRepository {
  /**
   * Looks up a Conversation by its `sessionId` (the Conversation `id`).
   *
   * @returns The matching {@link Conversation}, or `null` when none exists.
   */
  findBySessionId(sessionId: string): Promise<Conversation | null>;

  /**
   * Creates a new Conversation with a freshly generated UUID.
   *
   * @param metadata Optional JSON metadata; defaults to `{}` (never null).
   *                 `channel` defaults to `"web"`.
   */
  create(metadata?: Record<string, unknown>): Promise<Conversation>;

  /**
   * Resolves the Conversation for a turn: returns the existing one when
   * `sessionId` matches a stored Conversation, otherwise creates a fresh one.
   *
   * Never returns `null`. A missing, invalid, or non-matching `sessionId`
   * results in a brand-new Conversation.
   */
  findOrCreate(sessionId?: string): Promise<Conversation>;
}

/**
 * Maps a Prisma `Conversation` record onto the domain {@link Conversation}.
 *
 * Translates the persistence representation into the domain contract:
 * - `metadata` (`Prisma.JsonValue`) → `Record<string, unknown>`, coercing
 *   null/non-object values to `{}` so the domain invariant (never null) holds.
 * - `createdAt` (`Date`) → ISO 8601 string.
 * - `channel` (`string` column) → the extensible {@link ChannelType}.
 */
function toDomain(record: PrismaConversation): Conversation {
  const { metadata } = record;
  const normalizedMetadata: Record<string, unknown> =
    metadata !== null &&
    typeof metadata === "object" &&
    !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  return {
    id: record.id,
    channel: record.channel as ChannelType,
    createdAt: record.createdAt.toISOString(),
    metadata: normalizedMetadata,
  };
}

/**
 * Prisma-backed {@link ConversationRepository}.
 *
 * Uses the shared Prisma Client singleton so every repository instance reuses
 * the same connection pool.
 */
export class PrismaConversationRepository implements ConversationRepository {
  private readonly prisma = getPrismaClient();

  async findBySessionId(sessionId: string): Promise<Conversation | null> {
    const record = await this.prisma.conversation.findUnique({
      where: { id: sessionId },
    });
    return record === null ? null : toDomain(record);
  }

  async create(metadata?: Record<string, unknown>): Promise<Conversation> {
    // Default metadata to an empty object rather than null. The `channel` and
    // `createdAt`/`id` defaults come from the Prisma schema, so an omitted
    // channel resolves to "web" and createdAt to the insertion-time timestamp.
    const data: Prisma.ConversationCreateInput = {
      metadata: (metadata ?? {}) as Prisma.InputJsonValue,
    };
    const record = await this.prisma.conversation.create({ data });
    return toDomain(record);
  }

  async findOrCreate(sessionId?: string): Promise<Conversation> {
    if (sessionId !== undefined) {
      const existing = await this.findBySessionId(sessionId);
      if (existing !== null) {
        return existing;
      }
    }
    // No (matching) session: start a fresh conversation with a new UUID.
    return this.create();
  }
}
