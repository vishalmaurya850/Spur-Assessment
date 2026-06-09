/**
 * Typed configuration error.
 *
 * Raised by the fail-fast config loader when a required environment variable is
 * missing, or when a provided value is invalid (e.g. an unsupported
 * `LLM_PROVIDER` or an out-of-range `PORT`).
 *
 * Security: a `ConfigError` identifies the offending environment variable by
 * NAME only. It MUST NEVER carry or embed the variable's value, so the error is
 * always safe to log and surface during startup without leaking secrets such as
 * API keys or connection strings.
 */
export class ConfigError extends Error {
  /**
   * The name of the offending environment variable (e.g. `OPENAI_API_KEY`),
   * when the error pertains to a single variable. Never contains a value.
   */
  public readonly variableName?: string;

  constructor(message: string, variableName?: string) {
    super(message);
    this.name = "ConfigError";
    if (variableName !== undefined) {
      this.variableName = variableName;
    }
    // Restore the prototype chain for instanceof checks under transpilation.
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}
