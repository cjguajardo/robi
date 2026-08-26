// Command metadata for UI consumption and validation.
// The discriminated union lives in src/types/robi.ts.
//
// THIS MODULE IS CLIENT-SAFE. It must NOT read process.env, Node APIs,
// or anything else that breaks in the browser bundle. The server is
// the source of truth for validation (DESIGN.md §8); the client only
// needs sane UI defaults — see FALLBACK_CONFIG below.

import type { RobiCommand, RobiCommandType, RobiConfig } from "@/types/robi";

/** Human label per command type — used in /control UI. */
export const COMMAND_LABEL: Record<RobiCommandType, string> = {
  WALK_LEFT: "Caminar izquierda",
  WALK_RIGHT: "Caminar derecha",
  JUMP: "Saltar",
  STOP: "Detener",
  GREET: "Saludar",
  DANCE: "Bailar",
  CELEBRATE: "Celebrar",
  RESET: "Inicio",
  TELL_JOKE: "Chiste",
  TELL_RIDDLE: "Adivinanza",
  TELL_FACT: "Dato curioso",
  SAY_GOODBYE: "Chau",
  ANSWER_QUESTION: "Pregunta",
  UNKNOWN: "Desconocido",
};

/** Commands available as quick-action buttons in /control. */
export const QUICK_COMMANDS: RobiCommandType[] = [
  "WALK_LEFT",
  "WALK_RIGHT",
  "JUMP",
  "STOP",
  "GREET",
  "DANCE",
  "CELEBRATE",
  "RESET",
];

/** Maximum exposed by the compact keypad on /control. */
export const MAX_CONTROL_STEPS = 10;

/** Maximum accepted from interpreted commands, including microphone input. */
export const MAX_COMMAND_STEPS = 100;

/**
 * Client-side fallback config. Hardcoded — must NOT read env.
 *
 * Used by UI components (e.g. StepPicker) for rendering defaults before
 * the server's authoritative config arrives. The server accepts a wider
 * command range, while this client config intentionally keeps the manual
 * keypad compact.
 */
export const FALLBACK_CONFIG: RobiConfig = {
  maxSteps: MAX_CONTROL_STEPS,
  defaultSteps: 5,
  llmFallbackEnabled: false,
};

/**
 * Display block size — every step on the scene grid is this many CSS
 * pixels wide and tall. Single source of truth shared between the
 * /display stage transform and the server's per-step animation budget.
 *
 * Why 64px: big enough that 1-step moves are visible from across a
 * classroom. The manual control intentionally stays at 10 steps even
 * though an explicit voice command can request up to 100.
 */
export const BLOCK_PX = 64;

/**
 * Wall-clock time budget per block during a movement command. The
 * server uses this to estimate how long to hold the EXECUTING state
 * before COMPLETE, so multi-step moves animate end-to-end instead of
 * teleporting to the final position.
 */
export const MS_PER_BLOCK = 350;

/** Type guard — only structural commands, no UNKNOWN. */
export function isExecutable(
  command: RobiCommand
): command is Exclude<RobiCommand, { type: "UNKNOWN" }> {
  return command.type !== "UNKNOWN";
}
