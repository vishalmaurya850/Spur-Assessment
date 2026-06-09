/**
 * LLM service — the stable, vendor-neutral boundary.
 *
 * `DefaultLLMService` turns a bounded slice of conversation history plus the
 * just-sent user message into a {@link CompletionRequest}, issues it through an
 * injected {@link LLMProvider}, and returns the provider's reply text. It owns
 * the cost/safety caps (history bound, reply-token cap, request timeout) and is
 * the single place that translates any provider failure into a typed
 * {@link LLMError} via {@link mapProviderError}.
 *
 * It depends ONLY on the {@link LLMProvider} contract (not on any concrete
 * OpenAI/Anthropic adapter) and on the {@link KnowledgeBase} for the system
 * prompt, so the vendor can be swapped via composition without touching this
 * class.
 */
import type { KnowledgeBase } from "../knowledge/knowledgeBase.js";
import type { Message } from "../data/types.js";
import { mapProviderError } from "./errorMapping.js";
import type {
  CompletionMessage,
  CompletionRequest,
  LLMProvider,
} from "./types.js";

/**
 * Stable interface used by the rest of the application to obtain an LLM reply.
 *
 * `history` is ordered oldest→newest and already includes the just-persisted
 * user message as its last item; `userMessage` is that same message text,
 * passed for clarity/validation by callers.
 */
export interface LLMService {
  generateReply(history: Message[], userMessage: string): Promise<string>;
}

/**
 * Cost/safety caps applied to every completion request. Sourced from
 * `AppConfig` at composition time.
 */
export interface LLMServiceCaps {
  /** Max prior messages sent as context. */
  readonly maxHistoryMessages: number;
  /** Max tokens requested from the provider per reply. */
  readonly maxReplyTokens: number;
  /** Per-request provider timeout in milliseconds. */
  readonly llmTimeoutMs: number;
}

/**
 * Default {@link LLMService} implementation.
 *
 * Vendor-neutral: it only knows the {@link LLMProvider} contract and the
 * {@link KnowledgeBase}, plus the numeric caps.
 */
export class DefaultLLMService implements LLMService {
  private readonly provider: LLMProvider;
  private readonly knowledgeBase: KnowledgeBase;
  private readonly caps: LLMServiceCaps;

  constructor(
    provider: LLMProvider,
    knowledgeBase: KnowledgeBase,
    caps: LLMServiceCaps,
  ) {
    this.provider = provider;
    this.knowledgeBase = knowledgeBase;
    this.caps = caps;
  }

  /**
   * Generate a reply for the current chat turn.
   *
   * Preconditions: `userMessage` is non-empty and length-bounded; `history` is
   * ordered oldest→newest and includes the just-saved user message as its last
   * item.
   *
   * Postconditions: on a successful provider call, returns the provider's reply
   * text (non-empty). On ANY provider failure, throws a typed {@link LLMError}
   * with a user-safe message (no provider internals or secrets). Does not
   * mutate `history`.
   */
  async generateReply(
    history: Message[],
    userMessage: string,
  ): Promise<string> {
    const request = this.buildCompletionRequest(history, userMessage);

    let result;
    try {
      result = await this.provider.complete(request);
    } catch (err) {
      // Translate any vendor/SDK failure into a typed, user-safe LLMError so
      // provider internals never escape this layer.
      throw mapProviderError(err);
    }

    return result.text;
  }

  /**
   * Build the vendor-neutral completion request.
   *
   * - systemPrompt: persona + injected FAQ from the knowledge base.
   * - messages: the most recent `maxHistoryMessages` items, preserved in
   *   chronological oldest→newest order and role-mapped (`ai`→`assistant`,
   *   `user`→`user`). `userMessage` is already the last persisted user message
   *   in `history`, so it is NOT appended again.
   * - maxTokens / timeoutMs: the configured caps.
   */
  private buildCompletionRequest(
    history: Message[],
    _userMessage: string,
  ): CompletionRequest {
    const systemPrompt = this.knowledgeBase.getSystemPrompt();

    // Bound history for cost control; keep the most recent messages while
    // preserving their chronological order.
    const bounded = history.slice(-this.caps.maxHistoryMessages);

    const messages: CompletionMessage[] = bounded.map((m) => ({
      role: m.sender === "ai" ? "assistant" : "user",
      content: m.text,
    }));

    // `_userMessage` is intentionally not appended: it is already the last
    // item of `history`, and re-appending would duplicate it.

    return {
      systemPrompt,
      messages,
      maxTokens: this.caps.maxReplyTokens,
      timeoutMs: this.caps.llmTimeoutMs,
    };
  }
}
