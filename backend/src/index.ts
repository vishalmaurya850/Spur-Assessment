/**
 * Backend entrypoint.
 *
 * Bootstrap order:
 * 1. Import `bootstrap/loadEnv` for its side effect FIRST so the `.env` file is
 *    loaded into `process.env` before any configuration is read or validated.
 * 2. Hand off to `startServer`, which validates config (fail-fast), wires
 *    dependencies, and begins listening on `PORT` only after successful
 *    validation.
 *
 * The fully-wired Express app factory lives in `./server` and is exported there
 * (without listening) so it can be imported and driven directly.
 *
 * Note: the HTTP API is intentionally unauthenticated — authentication is out
 * of scope for this exercise.
 */
import "./bootstrap/loadEnv.js";
import { startServer } from "./server.js";

startServer();
