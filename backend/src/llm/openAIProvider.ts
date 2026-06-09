/**
 * OpenAI provider adapter.
 *
 * Translates a vendor-neutral {@link CompletionRequest} into an OpenAI Chat
 * Completions call and returns a {@link CompletionResult}. The adapter is a
 * thin boundary: it maps roles/params and returns the generated text. On
 * failure it throws the raw OpenAI SDK error UNCHANGED so the LLM service can
 * translate it into a typed `LLMError` via `mapProviderError`. It MUST NOT
 * swallow, wrap, or re-message the vendor error here.
 *
 * Security: the API key is supplied via the constructor by the composition
 * root, which sources it exclusively from the `OPENAI_API_KEY` environment
 * variable. This adapter never reads the key (nor any other secret) from
 * request input, query params, or hard-coded values.
 */
import OpenAI from "openai";
import type {
  CompletionRequest,
  CompletionResult,
  LLMProvider,
} from "./types.js";

/**
 * {@link LLMProvider} implementation backed by the OpenAI Chat Completions API.
 */
export class OpenAIProvider implements LLMProvider {
  public readonly name = "openai";

  private readonly client: OpenAI;
  private readonly model: string;

  /**
   * @param apiKey The OpenAI credential, sourced from `OPENAI_API_KEY` at
   *               composition time. Never accepted from request input.
   * @param model  The model name to call.
   */
  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  /**
   * Issue a chat completion. The system prompt is sent as a leading `system`
   * message, followed by the role-mapped history (already `user`/`assistant`).
   * `maxTokens` caps generation and `timeoutMs` bounds the request.
   *
   * Throws the raw OpenAI SDK error on failure (for the LLM service to map).
   */
  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const response = await this.client.chat.completions.create(
      {
        model: this.model,
        max_tokens: request.maxTokens,
        messages: [
          { role: "system", content: request.systemPrompt },
          ...request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
      },
      { timeout: request.timeoutMs },
    );

    const text = response.choices[0]?.message?.content ?? "";
    return { text };
  }
}
