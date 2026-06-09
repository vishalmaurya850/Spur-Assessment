/**
 * Environment bootstrap.
 *
 * Loads variables from a local `.env` file into `process.env` via `dotenv`.
 * It must run before any configuration is read or validated so the fail-fast
 * config loader sees the populated environment.
 *
 * Import this module for its side effect at the very top of the backend
 * entrypoint, before importing the config module or the composition root:
 *
 *   import "./bootstrap/loadEnv.js";
 *
 * Notes:
 * - `dotenv` does NOT override variables already present in the real
 *   environment, so values injected by the host (CI, container, Neon, etc.)
 *   always win over the `.env` file.
 * - No secret values are ever logged here. Only the (non-sensitive) path of
 *   the env file is referenced.
 */
import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Loads the `.env` file (if present) into `process.env`.
 *
 * @param envPath Optional explicit path to the env file. Defaults to `.env`
 *                resolved against the current working directory.
 * @returns `true` if an env file was found and loaded, `false` otherwise.
 */
export function loadEnv(envPath: string = resolve(process.cwd(), ".env")): boolean {
  if (!existsSync(envPath)) {
    // No local .env is fine in deployed environments where variables are
    // injected directly. Config validation runs next and will fail fast on
    // any genuinely missing required variable.
    return false;
  }

  const result = loadDotenv({ path: envPath });
  if (result.error) {
    // Surface a parse/read problem without leaking file contents or values.
    throw new Error(`Failed to load environment file at ${envPath}: ${result.error.message}`);
  }

  return true;
}

// Execute on import so a simple `import "./bootstrap/loadEnv"` is enough to
// guarantee the environment is populated before config validation.
loadEnv();
