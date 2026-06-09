/**
 * LLM layer contracts.
 *
 * These types form the stable boundary between the rest of the application and
 * any concrete vendor SDK. Concrete adapters (OpenAIProvider, AnthropicProvider)
 * implement `LLMProvider`, and `DefaultLLMService` builds a `CompletionRequest`
 * and consumes a `CompletionResult`.
 *
 * Keeping these in a dedicated module lets the conversation/composition layers
 * depend on the contract without importing any vendor SDK.
 */

/**
 * The role of a single message in the provider-facing conversation history.
 *
 * Internal `user`/`ai` senders are mapped to the vendor-neutral
 * `user`/`assistant` roles by the LLM service before the provider call.
 */
export type CompletionRole = "user" | "assistant";

/**
 * A single role-mapped message included as conversation context in a
 * completion request.
 */
export interface CompletionMessage {
  role: CompletionRole;
  content: string;
}

/**
 * A vendor-neutral request to generate a completion.
 *
 * Built by the LLM service. The `messages` array is bounded (at most the
 * configured history cap) and ordered oldest→newest. `maxTokens` and
 * `timeoutMs` are always set to enforce cost/safety caps.
 */
export interface CompletionRequest {
  /** Persona + injected FAQ knowledge base. */
  systemPrompt: string;
  /** Bounded, chronological (oldest→newest) role-mapped history. */
  messages: CompletionMessage[];
  /** Upper bound on tokens the provider may generate. */
  maxTokens: number;
  /** Per-call request timeout in milliseconds. */
  timeoutMs: number;
}

/**
 * A vendor-neutral successful completion result.
 */
export interface CompletionResult {
  /** The generated reply text. Expected to be non-empty on success. */
  text: string;
}

/**
 * Vendor adapter contract — implemented once per provider.
 *
 * Implementations translate a `CompletionRequest` into the vendor SDK call and
 * return a `CompletionResult`. On failure they throw the vendor/SDK error
 * unchanged; the LLM service is responsible for translating it into a typed
 * `LLMError` via `mapProviderError` so vendor internals never escape this layer.
 */
export interface LLMProvider {
  /** Stable adapter identifier (e.g. `"openai"`, `"anthropic"`). */
  readonly name: string;
  /** Issue a completion call to the underlying vendor. */
  complete(request: CompletionRequest): Promise<CompletionResult>;
}
