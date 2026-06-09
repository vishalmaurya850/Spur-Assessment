/**
 * Shared domain types for the data-access layer.
 *
 * These describe the domain shapes the repositories expose to the rest of the
 * application, decoupled from Prisma's generated model records. Repositories
 * are responsible for mapping Prisma records (with `Json` / `DateTime` fields)
 * into these plain, serializable shapes (e.g. `DateTime` → ISO 8601 string).
 *
 * Kept in a dedicated module so multiple repositories (Conversation, Message)
 * and the layers above them can depend on the same types without importing a
 * specific repository implementation.
 */

/**
 * The set of valid message senders.
 *
 * Constrained to exactly `user` or `ai`. This matches the Prisma `Sender` enum
 * defined in `schema.prisma`.
 */
export type Sender = "user" | "ai";

/**
 * A persisted chat message in its domain shape.
 *
 * - `id` is a generated UUID.
 * - `conversationId` references an existing `Conversation`.
 * - `sender` is constrained to the `Sender` union.
 * - `createdAt` is an ISO 8601 string (mapped from the DB `timestamptz`).
 */
export interface Message {
  id: string;
  conversationId: string;
  sender: Sender;
  text: string;
  createdAt: string;
}
