import { describe, expect, it } from "vitest";
import { initialWorld, reduceWorld, runCommand, type RobiWorld } from "./reducer";
import type { RobiCommand } from "@/types/robi";

describe("reducer — state transitions", () => {
  it("wakes from SLEEPING", () => {
    const next = reduceWorld({ ...initialWorld, state: "SLEEPING" }, { type: "WAKE" });
    expect(next.state).toBe("IDLE");
  });

  it("ignores WAKE if not sleeping", () => {
    const next = reduceWorld({ ...initialWorld, state: "IDLE" }, { type: "WAKE" });
    expect(next.state).toBe("IDLE");
  });

  it("EXECUTE UNKNOWN sets CONFUSED", () => {
    const next = reduceWorld(initialWorld, {
      type: "EXECUTE",
      command: { type: "UNKNOWN", raw: "fly" },
    });
    expect(next.state).toBe("CONFUSED");
  });

  it("COMPLETE returns to IDLE", () => {
    const next = reduceWorld(
      { ...initialWorld, state: "EXECUTING" },
      { type: "COMPLETE" },
    );
    expect(next.state).toBe("IDLE");
  });

  it("PAUSE freezes everything except RESUME/RESET", () => {
    const paused = reduceWorld({ ...initialWorld, state: "IDLE" }, { type: "PAUSE" });
    expect(paused.state).toBe("PAUSED");
    expect(paused.paused).toBe(true);

    const stuck = reduceWorld(paused, {
      type: "EXECUTE",
      command: { type: "WALK_LEFT", steps: 1 },
    });
    expect(stuck.state).toBe("PAUSED");

    const resumed = reduceWorld(paused, { type: "RESUME" });
    expect(resumed.state).toBe("IDLE");
    expect(resumed.paused).toBe(false);
  });

  it("RESET returns to initial world", () => {
    const dirty = {
      ...initialWorld,
      state: "PAUSED" as const,
      position: { x: 9, y: 9 },
      direction: "EAST" as const,
      paused: true,
      pendingMove: { x: 2, y: 0 },
    };
    const next = reduceWorld(dirty, { type: "RESET" });
    expect(next.position).toEqual({ x: 0, y: 0 });
    expect(next.direction).toBe("SOUTH");
    expect(next).toEqual(initialWorld);
  });

  it("runCommand helper does EXECUTE then COMPLETE (movement is queued, not applied)", () => {
    // runCommand is a test helper that runs the typical EXECUTE→COMPLETE
    // cycle. EXECUTE only queues the movement (pendingMove), so final
    // state still has the OLD position. In real flow, APPLY_MOVEMENT
    // (dispatched immediately by the realtime server) would commit it.
    const captured: RobiWorld[] = [];
    const final = runCommand(
      { ...initialWorld, state: "IDLE", position: { x: 0, y: 0 } },
      { type: "WALK_LEFT", steps: 2 },
      (w) => captured.push(w),
    );
    expect(captured.length).toBeGreaterThan(0);
    expect(captured[0].state).toBe("EXECUTING");
    expect(captured[0].position).toEqual({ x: 0, y: 0 }); // unchanged
    expect(captured[0].pendingMove).toEqual({ x: -2, y: 0 });
    expect(final.state).toBe("IDLE");
    // Position not applied (no APPLY_MOVEMENT in runCommand).
    expect(final.position).toEqual({ x: 0, y: 0 });
  });
});

describe("reducer — exhaustive command coverage", () => {
  const allCommands: RobiCommand[] = [
    { type: "WALK_LEFT", steps: 1 },
    { type: "WALK_RIGHT", steps: 1 },
    { type: "JUMP" },
    { type: "STOP" },
    { type: "GREET" },
    { type: "DANCE" },
    { type: "CELEBRATE" },
    { type: "RESET" },
    { type: "TELL_JOKE" },
    { type: "TELL_RIDDLE" },
    { type: "TELL_FACT" },
    { type: "SAY_GOODBYE" },
    { type: "ANSWER_QUESTION", question: "que es un robot" },
    { type: "UNKNOWN", raw: "x" },
  ];

  it("every command produces a valid state transition", () => {
    for (const cmd of allCommands) {
      const next = reduceWorld(initialWorld, { type: "EXECUTE", command: cmd });
      expect(typeof next.state).toBe("string");
    }
  });

  it("WALK_LEFT rotates to WEST and queues the translation as pendingMove (no eager position change)", () => {
    // The kid should see ROBI turn to face west and say the cue
    // without actually translating — the translation is applied
    // immediately afterward via the server's APPLY_MOVEMENT event.
    const start = { ...initialWorld, state: "IDLE" as const, direction: "SOUTH" as const, position: { x: 0, y: 0 } };
    const next = reduceWorld(start, {
      type: "EXECUTE",
      command: { type: "WALK_LEFT", steps: 3 },
    });
    expect(next.direction).toBe("WEST");
    expect(next.position).toEqual({ x: 0, y: 0 }); // NOT moved yet
    expect(next.pendingMove).toEqual({ x: -3, y: 0 });
    expect(next.state).toBe("EXECUTING");
  });

  it("WALK_RIGHT rotates to EAST and queues the translation as pendingMove", () => {
    const start = { ...initialWorld, state: "IDLE" as const, direction: "SOUTH" as const, position: { x: 0, y: 0 } };
    const next = reduceWorld(start, {
      type: "EXECUTE",
      command: { type: "WALK_RIGHT", steps: 2 },
    });
    expect(next.direction).toBe("EAST");
    expect(next.position).toEqual({ x: 0, y: 0 });
    expect(next.pendingMove).toEqual({ x: 2, y: 0 });
    expect(next.state).toBe("EXECUTING");
  });

  it("JUMP is pure in-place — no position change, no lateral advance", () => {
    // The user requested: "para el salto ROBI no debe avanzar
    // lateralmente, solo de manera vertical". Vertical motion comes
    // from the CSS `avatar-jump` keyframes (translateY). Position
    // never changes regardless of the avatar's facing direction.
    const start = { ...initialWorld, state: "IDLE" as const, direction: "NORTH" as const, position: { x: 5, y: 5 } };
    const next = reduceWorld(start, {
      type: "EXECUTE",
      command: { type: "JUMP" },
    });
    expect(next.direction).toBe("NORTH"); // JUMP does NOT rotate
    expect(next.position).toEqual({ x: 5, y: 5 }); // position unchanged
    expect(next.pendingMove).toBeNull();   // no deferred translation
    expect(next.state).toBe("EXECUTING");
  });

  it("JUMP doesn't advance even when facing EAST (lateral direction)", () => {
    const start = { ...initialWorld, state: "IDLE" as const, direction: "EAST" as const, position: { x: 2, y: 3 } };
    const next = reduceWorld(start, {
      type: "EXECUTE",
      command: { type: "JUMP" },
    });
    expect(next.direction).toBe("EAST");
    // Position must NOT shift on X (no lateral movement).
    expect(next.position).toEqual({ x: 2, y: 3 });
    expect(next.pendingMove).toBeNull();
  });

  it("non-movement content actions set EXECUTING without changing position", () => {
    const start = { ...initialWorld, state: "IDLE" as const, position: { x: 3, y: 2 } };
    for (const cmd of [
      { type: "TELL_JOKE" as const },
      { type: "TELL_RIDDLE" as const },
      { type: "TELL_FACT" as const },
      { type: "SAY_GOODBYE" as const },
      { type: "ANSWER_QUESTION" as const, question: "x" },
    ]) {
      const next = reduceWorld(start, { type: "EXECUTE", command: cmd });
      expect(next.state).toBe("EXECUTING");
      expect(next.position).toEqual({ x: 3, y: 2 });
      expect(next.pendingMove).toBeNull();
    }
  });
});

describe("reducer — APPLY_MOVEMENT (deferred translation)", () => {
  it("APPLY_MOVEMENT adds the pendingMove vector to position and clears it", () => {
    const start = {
      ...initialWorld,
      state: "EXECUTING" as const,
      position: { x: 0, y: 0 },
      pendingMove: { x: -3, y: 0 },
    };
    const next = reduceWorld(start, { type: "APPLY_MOVEMENT" });
    expect(next.position).toEqual({ x: -3, y: 0 });
    expect(next.pendingMove).toBeNull();
  });

  it("APPLY_MOVEMENT is a no-op when pendingMove is null (idempotent for non-movement commands)", () => {
    const start = {
      ...initialWorld,
      state: "EXECUTING" as const,
      position: { x: 7, y: 9 },
      pendingMove: null,
    };
    const next = reduceWorld(start, { type: "APPLY_MOVEMENT" });
    expect(next.position).toEqual({ x: 7, y: 9 });
    expect(next.pendingMove).toBeNull();
  });

  it("double-EXECUTE on the same direction compounds pendingMove correctly", () => {
    // After WALK_LEFT then a second WALK_LEFT before APPLY, the second
    // EXECUTE rotates again (still WEST) and REPLACES pendingMove with
    // a fresh vector. We don't accumulate stale deferred translations.
    const start = {
      ...initialWorld,
      state: "EXECUTING" as const,
      position: { x: 0, y: 0 },
      pendingMove: { x: -3, y: 0 },
    };
    const secondWalk = reduceWorld(start, {
      type: "EXECUTE",
      command: { type: "WALK_LEFT", steps: 2 },
    });
    expect(secondWalk.direction).toBe("WEST");
    expect(secondWalk.position).toEqual({ x: 0, y: 0 }); // unchanged
    expect(secondWalk.pendingMove).toEqual({ x: -2, y: 0 }); // REPLACED
  });
});
