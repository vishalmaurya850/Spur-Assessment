/**
 * MessageRepository — data access for chat messages.
 *
 * Owns all reads/writes of `Message` rows against Neon PostgreSQL via the
 * shared Prisma Client singleton. Repositories wrap Prisma so the rest of the
 * application stays decoupled from the ORM: this module maps between Prisma
 * model records and the domain `Message` shape (notably `DateTime` → ISO 8601
 * string).
 *
 * Security: every query goes through Prisma Client, which parameterizes all
 * queries by default. No hand-written SQL or string interpolation/concatenation
 * of untrusted input is used anywhere here.
 */
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { getPrismaClient } from "./prismaClient.js";
import type { Message, Sender } from "./types.js";
import { RepositoryError } from "../errors/RepositoryError.js";

/**
 * The persistence contract for chat messages.
 *
 * The backing implementation wraps Prisma Client; callers depend only on this
 * interface and the domain `Message` shape.
 */
export interface MessageRepository {
  /**
   * Persist a new message for an existing conversation.
   *
   * Rejects (persisting nothing) when:
   * - `sender` is not exactly `user` or `ai`, or
   * - `conversationId` does not reference an existing Conversation.
   */
  add(conversationId: string, sender: Sender, text: string): Promise<Message>;

  /**
   * Return the most recent `limit` messages for a conversation, ordered
   * ascending by `createdAt` (oldest → newest) chronologically.
   */
  getRecent(conversationId: string, limit: number): Promise<Message[]>;

  /**
   * Return all messages for a conversation ordered ascending by `createdAt`
   * (oldest → newest).
   */
  getAll(conversationId: string): Promise<Message[]>;
}

/** The only values a `sender` may take. */
const VALID_SENDERS: readonly Sender[] = ["user", "ai"];

/**
 * Shape of a Prisma `Message` record as returned by the generated client.
 * Declared structurally so this module does not need to import the generated
 * model type directly.
 */
interface PrismaMessageRecord {
  id: string;
  conversationId: string;
  sender: string;
  text: string;
  createdAt: Date;
}

/**
 * Map a Prisma `Message` record into the domain `Message` shape.
 *
 * Translates the `DateTime` (`Date`) column into an ISO 8601 string so the
 * domain object stays plain and serializable.
 */
function toDomain(record: PrismaMessageRecord): Message {
  return {
    id: record.id,
    conversationId: record.conversationId,
    // The DB enum constrains this to `user` | `ai`; assert to the domain union.
    sender: record.sender as Sender,
    text: record.text,
    createdAt: record.createdAt.toISOString(),
  };
}

/**
 * Prisma-backed implementation of {@link MessageRepository}.
 */
export class PrismaMessageRepository implements MessageRepository {
  private readonly prisma: PrismaClient;

  /**
   * @param prisma Optional client override. Defaults to the shared singleton so
   *               the connection pool is reused.
   */
  constructor(prisma: PrismaClient = getPrismaClient()) {
    this.prisma = prisma;
  }

  async add(
    conversationId: string,
    sender: Sender,
    text: string,
  ): Promise<Message> {
    // Reject an invalid sender BEFORE any write so nothing is persisted.
    // Guard at runtime: callers may be untyped (e.g. JSON).
    if (!VALID_SENDERS.includes(sender)) {
      throw new RepositoryError(
        "invalid_sender",
        "Invalid sender value: must be 'user' or 'ai'.",
      );
    }

    // Reject a write that references a non-existent conversation BEFORE any
    // write so nothing is persisted. Parameterized existence check via Prisma —
    // no raw SQL.
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    });
    if (conversation === null) {
      throw new RepositoryError(
        "conversation_not_found",
        "The referenced conversation does not exist.",
      );
    }

    try {
      const created = await this.prisma.message.create({
        data: { conversationId, sender, text },
      });
      return toDomain(created);
    } catch (err) {
      // Defend against the race where the conversation is deleted between the
      // existence check and the insert: a foreign-key violation (P2003) is
      // surfaced as the same typed rejection. Still never persists a message.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2003"
      ) {
        throw new RepositoryError(
          "conversation_not_found",
          "The referenced conversation does not exist.",
        );
      }
      throw err;
    }
  }

  async getRecent(conversationId: string, limit: number): Promise<Message[]> {
    // Fetch the most recent `limit` rows (descending), then return them in
    // ascending chronological order (oldest → newest) as required.
    const records = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return records.reverse().map(toDomain);
  }

  async getAll(conversationId: string): Promise<Message[]> {
    const records = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
    return records.map(toDomain);
  }
}
