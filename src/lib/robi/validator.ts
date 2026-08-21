// Validation layer — every command (including LLM output) passes through here.
// See DESIGN.md §8 (security: external services cannot run code directly).

import type { RobiCommand, RobiConfig } from "@/types/robi";

export type ValidationResult =
  | { ok: true; command: RobiCommand }
  | { ok: false; reason: string };

/**
 * Clamp + sanity-check a command.
 * - Steps are bounded between 1 and maxSteps (PRD RF-008).
 * - UNKNOWN commands are not executable; surface as invalid.
 */
export function validateCommand(
  command: unknown,
  config: RobiConfig
): ValidationResult {
  if (!command || typeof command !== "object") {
    return { ok: false, reason: "Command is not an object" };
  }
  const c = command as Partial<RobiCommand> & { type?: string };

  if (typeof c.type !== "string") {
    return { ok: false, reason: "Command is missing a type" };
  }

  switch (c.type) {
    case "WALK_LEFT":
    case "WALK_RIGHT": {
      const raw = typeof c.steps === "number" ? c.steps : config.defaultSteps;
      if (!Number.isFinite(raw)) {
        return { ok: false, reason: "Invalid steps" };
      }
      const steps = Math.max(1, Math.min(config.maxSteps, Math.round(raw)));
      switch (c.type) {
        case "WALK_LEFT":
          return { ok: true, command: { type: "WALK_LEFT", steps } };
        case "WALK_RIGHT":
          return { ok: true, command: { type: "WALK_RIGHT", steps } };
      }
    }

    case "STOP":
    case "GREET":
    case "DANCE":
    case "CELEBRATE":
    case "RESET":
    case "JUMP":
    // Non-movement content commands — content lives in responses.ts and
    // answer-question.ts; the reducer just needs to route them to EXECUTING.
    // The previous code dropped these into the `default` rejection branch,
    // which meant "contame un chiste" / "¿qué es un robot?" / "chau" all
    // went straight to CONFUSED instead of being executed.
    case "TELL_JOKE":
    case "TELL_RIDDLE":
    case "TELL_FACT":
    case "SAY_GOODBYE":
      return { ok: true, command: { type: c.type } };

    case "ANSWER_QUESTION": {
      // Free-form questions route to the LLM. Validate the payload so
      // a malformed command (empty/missing question) doesn't reach the
      // server's drainQueue with a string that breaks the prompt.
      const question =
        typeof c.question === "string" ? c.question.trim() : "";
      if (!question) {
        return { ok: false, reason: "ANSWER_QUESTION missing question text" };
      }
      return { ok: true, command: { type: "ANSWER_QUESTION", question } };
    }

    case "UNKNOWN":
      return { ok: false, reason: "Unknown command" };

    default:
      return { ok: false, reason: `Unsupported command type: ${c.type}` };
  }
}
