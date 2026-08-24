import { describe, expect, it } from "vitest";
import { validateCommand } from "./validator";
import { FALLBACK_CONFIG } from "./commands";

describe("validator", () => {
  it("uses the classroom movement defaults", () => {
    expect(FALLBACK_CONFIG).toMatchObject({ defaultSteps: 5, maxSteps: 10 });
  });

  it("clamps WALK_LEFT steps to maxSteps (PRD RF-008)", () => {
    expect(validateCommand({ type: "WALK_LEFT", steps: 99 }, FALLBACK_CONFIG)).toEqual({
      ok: true,
      command: { type: "WALK_LEFT", steps: FALLBACK_CONFIG.maxSteps },
    });
  });

  it("clamps WALK_RIGHT steps to minimum 1", () => {
    expect(validateCommand({ type: "WALK_RIGHT", steps: 0 }, FALLBACK_CONFIG)).toEqual({
      ok: true,
      command: { type: "WALK_RIGHT", steps: 1 },
    });
  });

  it("uses defaultSteps when missing on WALK_LEFT", () => {
    expect(validateCommand({ type: "WALK_LEFT" }, FALLBACK_CONFIG)).toEqual({
      ok: true,
      command: { type: "WALK_LEFT", steps: FALLBACK_CONFIG.defaultSteps },
    });
  });

  it("rejects MOVE_FORWARD and MOVE_BACKWARD (removed commands)", () => {
    // Forward/backward movement was removed — only lateral walk and jump.
    expect(validateCommand({ type: "MOVE_FORWARD" }, FALLBACK_CONFIG).ok).toBe(false);
    expect(validateCommand({ type: "MOVE_BACKWARD" }, FALLBACK_CONFIG).ok).toBe(false);
  });

  it("rejects UNKNOWN", () => {
    expect(validateCommand({ type: "UNKNOWN", raw: "x" }, FALLBACK_CONFIG).ok).toBe(false);
  });

  it("rejects missing type", () => {
    expect(validateCommand({}, FALLBACK_CONFIG).ok).toBe(false);
  });

  it("accepts every well-formed command type", () => {
    const types = [
      "STOP",
      "GREET",
      "DANCE",
      "CELEBRATE",
      "RESET",
      "JUMP",
      "TELL_JOKE",
      "TELL_RIDDLE",
      "TELL_FACT",
      "SAY_GOODBYE",
    ] as const;
    for (const type of types) {
      const result = validateCommand({ type }, FALLBACK_CONFIG);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.command.type).toBe(type);
    }
  });

  it("rejects TURN_LEFT and TURN_RIGHT (removed commands)", () => {
    // In-place rotation was removed — only lateral walk and jump remain.
    expect(validateCommand({ type: "TURN_LEFT" }, FALLBACK_CONFIG).ok).toBe(false);
    expect(validateCommand({ type: "TURN_RIGHT" }, FALLBACK_CONFIG).ok).toBe(false);
  });

  it("accepts WALK_LEFT and WALK_RIGHT with steps", () => {
    expect(validateCommand({ type: "WALK_LEFT", steps: 2 }, FALLBACK_CONFIG)).toEqual({
      ok: true,
      command: { type: "WALK_LEFT", steps: 2 },
    });
    expect(validateCommand({ type: "WALK_RIGHT" }, FALLBACK_CONFIG)).toEqual({
      ok: true,
      command: { type: "WALK_RIGHT", steps: FALLBACK_CONFIG.defaultSteps },
    });
  });

  it("clamps WALK_LEFT steps to maxSteps (PRD RF-008)", () => {
    expect(validateCommand({ type: "WALK_LEFT", steps: 99 }, FALLBACK_CONFIG)).toEqual({
      ok: true,
      command: { type: "WALK_LEFT", steps: FALLBACK_CONFIG.maxSteps },
    });
  });

  it("accepts ANSWER_QUESTION with a non-empty question", () => {
    const result = validateCommand(
      { type: "ANSWER_QUESTION", question: "que es un robot" },
      FALLBACK_CONFIG,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.command.type).toBe("ANSWER_QUESTION");
      if (result.command.type === "ANSWER_QUESTION") {
        expect(result.command.question).toBe("que es un robot");
      }
    }
  });

  it("rejects ANSWER_QUESTION without a question payload", () => {
    expect(
      validateCommand({ type: "ANSWER_QUESTION" }, FALLBACK_CONFIG).ok,
    ).toBe(false);
    expect(
      validateCommand(
        { type: "ANSWER_QUESTION", question: "   " },
        FALLBACK_CONFIG,
      ).ok,
    ).toBe(false);
  });

  it("rejects unknown command type strings", () => {
    expect(validateCommand({ type: "FLY" }, FALLBACK_CONFIG).ok).toBe(false);
  });
});
