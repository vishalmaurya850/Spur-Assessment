/**
 * Fail-fast configuration loader and validator.
 *
 * Reads ALL application configuration from environment variables, validates it,
 * and either returns a fully-typed, frozen `AppConfig` or throws a typed
 * `ConfigError`. The composition root MUST call `loadConfig()` before the
 * server begins listening so startup aborts on any missing or invalid required
 * variable.
 *
 * Security: errors identify an offending variable by NAME only and never embed
 * its value, so they are safe to log during startup. The returned `AppConfig`
 * does carry the resolved secret (`apiKey`) for downstream use, but it is never
 * logged or serialized by this module.
 *
 * The `.env` file (if any) must already be loaded into `process.env` by
 * `bootstrap/loadEnv` before this runs.
 */
import { ConfigError } from "../errors/ConfigError.js";

/** Supported LLM vendors. */
export type LLMProvider = "openai" | "anthropic";

/** The accepted `LLM_PROVIDER` values, used for validation and messaging. */
const VALID_PROVIDERS: readonly LLMProvider[] = ["openai", "anthropic"] as const;

/** Default values applied when the corresponding variable is unset. */
export const CONFIG_DEFAULTS = {
  MAX_MESSAGE_CHARS: 4000,
  MAX_HISTORY_MESSAGES: 20,
  MAX_REPLY_TOKENS: 512,
  LLM_TIMEOUT_MS: 30000,
  PORT: 3000,
} as const;

/** Inclusive valid range for the server listening port. */
const PORT_MIN = 1;
const PORT_MAX = 65535;

/**
 * Fully validated, immutable application configuration.
 */
export interface AppConfig {
  /** Selected LLM vendor. */
  readonly provider: LLMProvider;
  /**
   * The resolved provider credential for `provider`, read from
   * `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`. Sensitive — never log this value.
   */
  readonly apiKey: string;
  /** Model identifier passed to the provider. */
  readonly model: string;
  /** Neon pooled runtime connection string. */
  readonly databaseUrl: string;
  /** Neon direct/unpooled migration connection string. */
  readonly directUrl: string;
  /** Max characters of an inbound user message. */
  readonly maxMessageChars: number;
  /** Max prior messages sent as LLM context. */
  readonly maxHistoryMessages: number;
  /** Max tokens requested from the provider per reply. */
  readonly maxReplyTokens: number;
  /** Per-request provider timeout in milliseconds. */
  readonly llmTimeoutMs: number;
  /** Server listening port. */
  readonly port: number;
}

/** Environment source. Defaults to `process.env`; injectable for testing. */
export type EnvSource = Record<string, string | undefined>;

/**
 * Reads a required string variable, treating absent/empty/whitespace-only as
 * missing. Throws a `ConfigError` naming the variable (never its value).
 */
function requireString(env: EnvSource, name: string): string {
  const raw = env[name];
  if (raw === undefined || raw.trim().length === 0) {
    throw new ConfigError(
      `Missing required environment variable: ${name}.`,
      name,
    );
  }
  return raw.trim();
}

/**
 * Reads an optional positive-integer variable, applying `defaultValue` when the
 * variable is unset/empty. Throws a `ConfigError` (naming the variable, not its
 * value) when present but not a valid integer ≥ 1.
 */
function readPositiveInt(
  env: EnvSource,
  name: string,
  defaultValue: number,
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim().length === 0) {
    return defaultValue;
  }
  const trimmed = raw.trim();
  // Reject anything that is not a base-10 integer (no decimals, signs, NaN).
  if (!/^\d+$/.test(trimmed)) {
    throw new ConfigError(
      `Invalid value for environment variable ${name}: expected a positive integer.`,
      name,
    );
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new ConfigError(
      `Invalid value for environment variable ${name}: expected a positive integer.`,
      name,
    );
  }
  return parsed;
}

/**
 * Reads and validates the server port: default 3000, valid range 1–65535
 * inclusive. Throws a `ConfigError` (naming `PORT`) when out of range or
 * non-integer.
 */
function readPort(env: EnvSource): number {
  const raw = env.PORT;
  if (raw === undefined || raw.trim().length === 0) {
    return CONFIG_DEFAULTS.PORT;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new ConfigError(
      `Invalid value for environment variable PORT: expected an integer in the range ${PORT_MIN}-${PORT_MAX}.`,
      "PORT",
    );
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (parsed < PORT_MIN || parsed > PORT_MAX) {
    throw new ConfigError(
      `Invalid value for environment variable PORT: expected an integer in the range ${PORT_MIN}-${PORT_MAX}.`,
      "PORT",
    );
  }
  return parsed;
}

/**
 * Validates the `LLM_PROVIDER` selection.
 *
 * Throws a `ConfigError` identifying the invalid selection when the variable is
 * unset or holds a value other than `openai`/`anthropic`. The offending value
 * is non-secret (it is the provider name itself), so echoing it aids operators.
 */
function readProvider(env: EnvSource): LLMProvider {
  const raw = env.LLM_PROVIDER;
  if (raw === undefined || raw.trim().length === 0) {
    throw new ConfigError(
      `Missing required environment variable: LLM_PROVIDER. Expected one of: ${VALID_PROVIDERS.join(", ")}.`,
      "LLM_PROVIDER",
    );
  }
  const value = raw.trim();
  if (!VALID_PROVIDERS.includes(value as LLMProvider)) {
    throw new ConfigError(
      `Invalid value for environment variable LLM_PROVIDER: "${value}". Expected one of: ${VALID_PROVIDERS.join(", ")}.`,
      "LLM_PROVIDER",
    );
  }
  return value as LLMProvider;
}

/**
 * Loads and validates all configuration from the given environment source.
 *
 * @param env Environment to read from. Defaults to `process.env`.
 * @returns A frozen, fully validated `AppConfig`.
 * @throws {ConfigError} On any missing required variable or invalid value. The
 *   error names the offending variable without exposing its value.
 */
export function loadConfig(env: EnvSource = process.env): AppConfig {
  // 1. Provider selection — validate first so the matching credential variable
  //    can be selected.
  const provider = readProvider(env);

  // 2. Matching provider credential. Missing key is reported by variable name
  //    only.
  const apiKeyVar = provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
  const apiKey = requireString(env, apiKeyVar);

  // 3. Required model + database connection strings.
  const model = requireString(env, "LLM_MODEL");
  const databaseUrl = requireString(env, "DATABASE_URL");
  const directUrl = requireString(env, "DIRECT_URL");

  // 4. Cost/safety caps with defaults.
  const maxMessageChars = readPositiveInt(
    env,
    "MAX_MESSAGE_CHARS",
    CONFIG_DEFAULTS.MAX_MESSAGE_CHARS,
  );
  const maxHistoryMessages = readPositiveInt(
    env,
    "MAX_HISTORY_MESSAGES",
    CONFIG_DEFAULTS.MAX_HISTORY_MESSAGES,
  );
  const maxReplyTokens = readPositiveInt(
    env,
    "MAX_REPLY_TOKENS",
    CONFIG_DEFAULTS.MAX_REPLY_TOKENS,
  );
  const llmTimeoutMs = readPositiveInt(
    env,
    "LLM_TIMEOUT_MS",
    CONFIG_DEFAULTS.LLM_TIMEOUT_MS,
  );

  // 5. Server port.
  const port = readPort(env);

  return Object.freeze({
    provider,
    apiKey,
    model,
    databaseUrl,
    directUrl,
    maxMessageChars,
    maxHistoryMessages,
    maxReplyTokens,
    llmTimeoutMs,
    port,
  });
}
