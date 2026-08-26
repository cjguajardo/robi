// Server-only authoritative config — reads process.env at module load.
// NEVER import this from a client-side module. Vite/Astro DO NOT inject
// process.env into the browser bundle; using it in client code throws
// `ReferenceError: process is not defined` at hydration (the bug that
// prompted this split).
//
// Why process.env and not import.meta.env: server.mjs runs under raw
// Node via tsx with no Vite transform, so import.meta.env is undefined
// there. process.env is available in every runtime we ship (server.mjs,
// Astro server endpoints, vitest).
//
// The `.server.ts` suffix is an Astro convention that makes the
// server-only intent explicit and prevents accidental client imports.

import type { RobiConfig } from "@/types/robi";
import { FALLBACK_CONFIG, MAX_COMMAND_STEPS } from "./commands";

/**
 * Authoritative runtime config. Combines fixed product invariants with
 * environment-backed defaults, and is built once at server startup.
 * Treat as immutable — pass it around, don't mutate.
 */
export const SERVER_CONFIG: RobiConfig = {
  // Product invariant: interpreted movement supports the complete 1-100
  // range. This is intentionally not environment-configurable; a stale
  // MAX_STEPS=5 deployment previously truncated valid voice commands
  // while the walking sprite kept playing for the requested duration.
  maxSteps: MAX_COMMAND_STEPS,
  defaultSteps: Number(process.env.DEFAULT_STEPS ?? FALLBACK_CONFIG.defaultSteps),
  llmFallbackEnabled:
    String(process.env.LLM_FALLBACK_ENABLED ?? "false") === "true",
};
