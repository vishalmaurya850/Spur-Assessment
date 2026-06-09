/**
 * Knowledge base.
 *
 * Seeds the agent with reliable domain knowledge about the fictional store and
 * exposes it as a ready-to-use system prompt. The system prompt combines a
 * fixed support-agent persona with the store FAQ facts (shipping policy,
 * return/refund policy, support hours) and an explicit instruction to say when
 * a topic is not covered rather than inventing policy.
 */

/**
 * Supplies the persona and store FAQ used to build the LLM system prompt.
 *
 * The default {@link StaticKnowledgeBase} hardcodes the facts. A future
 * implementation (e.g. loading from the database) can satisfy this same
 * interface without changing any callers (the LLM service).
 */
export interface KnowledgeBase {
  /** Returns the full system prompt: persona + formatted FAQ block. */
  getSystemPrompt(): string;
}

/**
 * A single store FAQ topic and its authoritative answer.
 *
 * The `topic` doubles as a human-readable label rendered into the FAQ block,
 * making it easy to extend the knowledge base with additional covered topics.
 */
interface FaqEntry {
  readonly topic: string;
  readonly fact: string;
}

/** The fictional store's display name used throughout the persona and FAQ. */
const STORE_NAME = "Nimbus Goods";

/**
 * Fixed support-agent persona prepended to the system prompt.
 *
 * Keeps the agent on-brand, concise, and grounded in the FAQ facts only.
 */
const PERSONA = [
  `You are the AI customer support agent for ${STORE_NAME}, a fictional online`,
  "e-commerce store. You are friendly, concise, and professional. Speak in a",
  "warm, helpful tone and keep answers short and easy to scan.",
  "",
  "Answer customer questions using ONLY the verified store policy facts listed",
  "below. These facts are the single source of truth about store policies.",
].join("\n");

/**
 * The authoritative store FAQ facts. These are the ONLY policy facts the agent
 * may assert. Each entry maps a covered topic to its concrete policy text.
 */
const FAQ_ENTRIES: readonly FaqEntry[] = [
  {
    topic: "Shipping policy",
    fact: [
      "We ship to all 50 U.S. states. Standard shipping is a flat $5.99 and",
      "arrives in 3–5 business days. Express shipping is $14.99 and arrives in",
      "1–2 business days. Orders over $50 qualify for free standard shipping.",
      "Orders are processed and dispatched within 1 business day; orders placed",
      "after 2 PM ET ship the next business day. We do not currently ship",
      "internationally.",
    ].join(" "),
  },
  {
    topic: "Return and refund policy",
    fact: [
      "Items can be returned within 30 days of delivery for a full refund, as",
      "long as they are unused and in their original packaging. Return shipping",
      "is free using the prepaid label included with every order. Refunds are",
      "issued to the original payment method within 5–7 business days after we",
      "receive the returned item. Final-sale and clearance items are not",
      "eligible for return.",
    ].join(" "),
  },
  {
    topic: "Support hours",
    fact: [
      "Our customer support team is available Monday through Friday, 9 AM to",
      "6 PM Eastern Time, excluding U.S. public holidays. We are closed on",
      "weekends. Messages sent outside these hours are answered on the next",
      "business day.",
    ].join(" "),
  },
];

/**
 * Closing instruction enforcing the "don't invent policy" guardrail.
 *
 * Lists the covered topics explicitly so the model can tell what is in scope.
 */
const NOT_COVERED_INSTRUCTION = [
  "If a customer asks about anything not covered by the policy facts above",
  "(that is, any topic other than shipping policy, return/refund policy, or",
  "support hours), do NOT guess or invent an answer. Instead, clearly tell the",
  "customer that you do not have that information and suggest they contact the",
  `${STORE_NAME} support team during support hours. Never state a policy fact`,
  "that is not listed above.",
].join(" ");

/**
 * Renders the FAQ entries into a numbered, labeled block for the system prompt.
 */
function formatFaqBlock(entries: readonly FaqEntry[]): string {
  return entries.map((entry) => `- ${entry.topic}: ${entry.fact}`).join("\n");
}

/**
 * Default {@link KnowledgeBase} implementation backed by hardcoded store facts.
 *
 * The assembled system prompt is deterministic, so callers may treat the output
 * as stable for a given build.
 */
export class StaticKnowledgeBase implements KnowledgeBase {
  /**
   * Builds the complete system prompt: persona, the verified FAQ facts, and the
   * not-covered guardrail instruction.
   */
  getSystemPrompt(): string {
    return [
      PERSONA,
      "",
      "Store policy facts:",
      formatFaqBlock(FAQ_ENTRIES),
      "",
      NOT_COVERED_INSTRUCTION,
    ].join("\n");
  }
}
