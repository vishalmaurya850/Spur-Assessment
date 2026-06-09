/**
 * Conversation service.
 *
 * Orchestrates a single chat turn end-to-end and serves conversation history.
 * This is the core, channel-agnostic domain logic: it knows nothing about HTTP
 * and nothing about any specific LLM vendor. It coordinates the conversation
 * and message repositories with the {@link LLMService}.
 *
 * The turn flow: resolve or create the conversation, persist the user message
 * before calling the LLM (so it is never lost on failure), load bounded
 * history, generate a reply (falling back to a friendly degraded reply on LLM
 * error), persist the AI reply, and return the result. Data-layer failures
 * propagate to the caller rather than being swallowed.
 */
import type { ConversationRepository } from "../data/conversationRepository.js";
import type { MessageRepository } from "../data/messageRepository.js";
import type { Message } from "../data/types.js";
import type { LLMService } from "../llm/llmService.js";
import { isLLMError } from "../errors/LLMError.js";
import type {
  ChatMessageView,
  ChatTurnResult,
  InboundMessage,
} from "./types.js";

/**
 * Stable contract for the conversation service.
 */
export interface ConversationService {
  handleMessage(input: InboundMessage): Promise<ChatTurnResult>;
  getHistory(sessionId: string): Promise<ChatMessageView[]>;
}

/**
 * Fixed, user-safe degraded reply used when the LLM call fails.
 *
 * Security: this is a static string that contains no provider name, raw
 * payload, status detail, stack trace, or secret. It is intentionally non-empty
 * so the customer always gets a usable response.
 */
const DEGRADED_REPLY =
  "Sorry, I'm having trouble responding right now. Please try again in a moment.";

/**
 * Produce a friendly, non-leaking fallback reply for an LLM failure.
 *
 * Always returns the same fixed {@link DEGRADED_REPLY}. The error is accepted
 * (and ignored for content purposes) so the caller can branch on whether the
 * failure was a typed {@link import("../errors/LLMError.js").LLMError}; either
 * way the user-facing text never reflects provider internals.
 */
function friendlyFallbackFor(_err: unknown): string {
  return DEGRADED_REPLY;
}

/**
 * Map a persisted domain {@link Message} onto the client-facing
 * {@link ChatMessageView}, renaming `createdAt` → `timestamp` and dropping the
 * internal `conversationId`.
 */
function toView(message: Message): ChatMessageView {
  return {
    id: message.id,
    sender: message.sender,
    text: message.text,
    timestamp: message.createdAt,
  };
}

/**
 * Default {@link ConversationService} implementation.
 *
 * Dependencies are injected via the constructor so the service can be composed
 * with Prisma-backed repositories in production and fakes in tests.
 */
export class DefaultConversationService implements ConversationService {
  private readonly conversationRepo: ConversationRepository;
  private readonly messageRepo: MessageRepository;
  private readonly llmService: LLMService;
  private readonly maxHistoryMessages: number;

  /**
   * @param conversationRepo   Resolves/creates the conversation for a turn.
   * @param messageRepo        Persists and reads chat messages.
   * @param llmService         Generates the AI reply.
   * @param maxHistoryMessages Upper bound on prior messages loaded as context.
   */
  constructor(
    conversationRepo: ConversationRepository,
    messageRepo: MessageRepository,
    llmService: LLMService,
    maxHistoryMessages: number,
  ) {
    this.conversationRepo = conversationRepo;
    this.messageRepo = messageRepo;
    this.llmService = llmService;
    this.maxHistoryMessages = maxHistoryMessages;
  }

  /**
   * Orchestrate a single chat turn.
   *
   * Precondition: `input.text` is already validated and normalized (non-empty,
   * length-capped) by the validator.
   *
   * Flow:
   * 1. Resolve or create the conversation for `input.sessionId`.
   * 2. Persist the user message FIRST so it is never lost on LLM failure.
   * 3. Load bounded history for LLM context.
   * 4. Call the LLM; on a typed {@link LLMError} substitute a non-empty
   *    degraded reply and mark the turn degraded.
   * 5. Persist exactly one AI message (real reply or fallback).
   * 6. Return `{ reply, sessionId, degraded }` with `sessionId` equal to the
   *    conversation `id`.
   *
   * Data-layer failures (from either repository) and any non-LLM error
   * propagate to the caller rather than being swallowed, so the route returns
   * HTTP 500 and never reports a successful turn for a failed request.
   */
  async handleMessage(input: InboundMessage): Promise<ChatTurnResult> {
    const conversation = await this.conversationRepo.findOrCreate(
      input.sessionId,
    );

    // Persist the user message BEFORE the LLM call so it is never lost even if
    // the LLM fails. A repository failure here propagates.
    await this.messageRepo.add(conversation.id, "user", input.text);

    const history = await this.messageRepo.getRecent(
      conversation.id,
      this.maxHistoryMessages,
    );

    let replyText: string;
    let degraded = false;
    try {
      replyText = await this.llmService.generateReply(history, input.text);
    } catch (err) {
      // Only an LLM failure degrades gracefully. Any other error (including a
      // data-layer failure surfaced elsewhere) is not handled here.
      if (!isLLMError(err)) {
        throw err;
      }
      replyText = friendlyFallbackFor(err);
      degraded = true;
    }

    // Persist exactly one AI message (real reply or degraded reply). A failure
    // here propagates rather than returning a successful turn.
    await this.messageRepo.add(conversation.id, "ai", replyText);

    return { reply: replyText, sessionId: conversation.id, degraded };
  }

  /**
   * Return the persisted history for `sessionId` as client-facing views.
   *
   * Resolves the conversation by `sessionId`; when none exists, returns an
   * empty array. Otherwise returns every persisted message ordered oldest-first
   * mapped to {@link ChatMessageView}.
   *
   * Data-layer failures propagate to the caller.
   */
  async getHistory(sessionId: string): Promise<ChatMessageView[]> {
    const conversation =
      await this.conversationRepo.findBySessionId(sessionId);
    if (conversation === null) {
      return [];
    }

    const messages = await this.messageRepo.getAll(conversation.id);
    return messages.map(toView);
  }
}
