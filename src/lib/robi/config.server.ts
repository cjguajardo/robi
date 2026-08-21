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
import { FALLBACK_CONFIG } from "./commands";

/**
 * Authoritative runtime config. Built once at server startup from
 * environment variables, falling back to FALLBACK_CONFIG when unset.
 * Treat as immutable — pass it around, don't mutate.
 */
export const SERVER_CONFIG: RobiConfig = {
  maxSteps: Number(process.env.MAX_STEPS ?? FALLBACK_CONFIG.maxSteps),
  defaultSteps: Number(process.env.DEFAULT_STEPS ?? FALLBACK_CONFIG.defaultSteps),
  llmFallbackEnabled:
    String(process.env.LLM_FALLBACK_ENABLED ?? "false") === "true",
};