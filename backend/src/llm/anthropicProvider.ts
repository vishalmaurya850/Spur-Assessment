/**
 * Anthropic provider adapter.
 *
 * Translates a vendor-neutral {@link CompletionRequest} into an Anthropic
 * Messages API call and returns a {@link CompletionResult}. Like the OpenAI
 * adapter, it is a thin boundary: it maps the system prompt + role-mapped
 * history and returns the generated text. On failure it throws the raw
 * Anthropic SDK error UNCHANGED so the LLM service can translate it into a
 * typed `LLMError` via `mapProviderError`. It MUST NOT swallow, wrap, or
 * re-message the vendor error here.
 *
 * Note: unlike OpenAI, Anthropic takes the system prompt as a top-level
 * `system` parameter rather than as a message in the `messages` array.
 *
 * Security: the API key is supplied via the constructor by the composition
 * root, which sources it exclusively from the `ANTHROPIC_API_KEY` environment
 * variable. This adapter never reads the key (nor any other secret) from
 * request input, query params, or hard-coded values.
 */
import Anthropic from "@anthropic-ai/sdk";
import type {
  CompletionRequest,
  CompletionResult,
  LLMProvider,
} from "./types.js";

/**
 * {@link LLMProvider} implementation backed by the Anthropic Messages API.
 */
export class AnthropicProvider implements LLMProvider {
  public readonly name = "anthropic";

  private readonly client: Anthropic;
  private readonly model: string;

  /**
   * @param apiKey The Anthropic credential, sourced from `ANTHROPIC_API_KEY` at
   *               composition time. Never accepted from request input.
   * @param model  The model name to call.
   */
  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  /**
   * Issue a messages call. The system prompt is passed as the top-level
   * `system` parameter; the role-mapped history (already `user`/`assistant`)
   * forms the `messages` array. `max_tokens` caps generation and `timeoutMs`
   * bounds the request.
   *
   * Throws the raw Anthropic SDK error on failure (for the LLM service to map).
   */
  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const response = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: request.maxTokens,
        system: request.systemPrompt,
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      },
      { timeout: request.timeoutMs },
    );

    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
    return { text };
  }
}
