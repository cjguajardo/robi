// State machine for ROBI — single source of truth.
// Pure reducer, no side effects. See DESIGN.md §11, §13.

import type {
  Direction,
  Position,
  RobiCommand,
  RobiEvent,
  RobiState,
} from "@/types/robi";

export interface RobiWorld {
  state: RobiState;
  position: Position;
  direction: Direction;
  paused: boolean;
  /**
   * Deferred movement vector for WALK_LEFT / WALK_RIGHT / JUMP.
   *
   * EXECUTE for movement commands sets this but DOES NOT change
   * `position` — the kid sees ROBI say the audio cue in place. The
   * server then dispatches an `APPLY_MOVEMENT` event after audio
   * playback ends, which adds the vector to `position` and broadcasts
   * a fresh WORLD_CHANGED. The CSS parallax + sprite shift animation
   * only runs from that moment, so the visual move is tied to the
   * post-audio walking animation — not to the command itself.
   *
   * `null` means no pending movement.
   */
  pendingMove: Position | null;
}

/** Initial world state — sleeping, centered, facing south. */
export const initialWorld: RobiWorld = {
  state: "SLEEPING",
  position: { x: 0, y: 0 },
  direction: "SOUTH",
  paused: false,
  pendingMove: null,
};

/** Apply a movement command to a position.
 *  Cardinal vectors: NORTH (0,+1), EAST (+1,0), SOUTH (0,-1), WEST (-1,0). */
function move(
  pos: Position,
  dir: Direction,
  steps: number,
  forward: boolean
): Position {
  const sign = forward ? 1 : -1;
  switch (dir) {
    case "NORTH":
      return { x: pos.x, y: pos.y + steps * sign };
    case "SOUTH":
      return { x: pos.x, y: pos.y - steps * sign };
    case "EAST":
      return { x: pos.x + steps * sign, y: pos.y };
    case "WEST":
      return { x: pos.x - steps * sign, y: pos.y };
  }
}

/**
 * Map a cardinal direction to a unit-step offset. Used for JUMP, which
 * moves one block in the CURRENT direction (NOT reorienting ROBI).
 */
function directionOffset(dir: Direction, steps: number): Position {
  switch (dir) {
    case "NORTH":
      return { x: 0, y: steps };
    case "SOUTH":
      return { x: 0, y: -steps };
    case "EAST":
      return { x: steps, y: 0 };
    case "WEST":
      return { x: -steps, y: 0 };
  }
}

/**
 * Reducer — single transition function. No boolean flags.
 * Side-effect-free; clients compute animation timing separately.
 */
export function reduceWorld(world: RobiWorld, event: RobiEvent): RobiWorld {
  // Global guards first — pause freezes everything except resume/reset.
  if (world.paused && event.type !== "RESUME" && event.type !== "RESET") {
    return world;
  }

  switch (event.type) {
    case "WAKE":
      // Can only wake from SLEEPING or PAUSED.
      if (world.state === "SLEEPING") {
        return { ...world, state: "IDLE" };
      }
      return world;

    case "LISTEN":
      // Listening is allowed from any active state.
      if (world.state !== "PAUSED") {
        return { ...world, state: "LISTENING" };
      }
      return world;

    case "THINK":
      // Only meaningful after listening or speaking.
      if (
        world.state === "LISTENING" ||
        world.state === "IDLE" ||
        world.state === "SPEAKING"
      ) {
        return { ...world, state: "THINKING" };
      }
      return world;

    case "SPEAK":
      // Any non-paused state can speak.
      if (world.state !== "PAUSED") {
        return { ...world, state: "SPEAKING" };
      }
      return world;

    case "EXECUTE": {
      const cmd = event.command;
      if (cmd.type === "UNKNOWN") {
        return { ...world, state: "CONFUSED" };
      }
      // Movement commands update DIRECTION immediately (so the avatar
      // faces the new heading) but DEFER the position change into
      // `pendingMove`. The actual translation happens on APPLY_MOVEMENT,
      // which is dispatched by the server AFTER audio playback ends —
      // so the kid sees ROBI say "¡A la izquierda!" in place first,
      // then watch the avatar walk toward the destination.
      switch (cmd.type) {
        // Lateral walking — rotate first, queue the translation.
        case "WALK_LEFT":
          return {
            ...world,
            state: "EXECUTING",
            direction: "WEST",
            pendingMove: { x: -cmd.steps, y: 0 },
          };
        case "WALK_RIGHT":
          return {
            ...world,
            state: "EXECUTING",
            direction: "EAST",
            pendingMove: { x: cmd.steps, y: 0 },
          };
        // Jump — pure vertical hop, in-place. No position translation
        // (the kid sees only the sprite animation + the CSS
        // `avatar-jump` keyframes translating Y for ~700ms). The user
        // asked specifically for "no lateral advancement" — JUMP is
        // always in-place regardless of facing direction. The audio
        // is "¡Hopp!" / "¡Hyup!" (generic), so this matches.
        case "JUMP":
          return {
            ...world,
            state: "EXECUTING",
            pendingMove: null,
          };
        case "STOP":
          return { ...world, state: "IDLE", pendingMove: null };
        case "GREET":
          return { ...world, state: "EXECUTING", pendingMove: null };
        case "DANCE":
          return { ...world, state: "EXECUTING", pendingMove: null };
        case "CELEBRATE":
          return {
            ...world,
            state: "CELEBRATING",
            pendingMove: null,
          };
        case "RESET":
          return { ...initialWorld, state: "IDLE" };
        // Non-movement content actions — no position/direction change.
        case "TELL_JOKE":
        case "TELL_RIDDLE":
        case "TELL_FACT":
        case "SAY_GOODBYE":
        case "ANSWER_QUESTION":
          return {
            ...world,
            state: "EXECUTING",
            pendingMove: null,
          };
      }
    }

    case "APPLY_MOVEMENT": {
      // Apply the deferred position translation. Idempotent for
      // commands that don't move (pendingMove is null).
      if (!world.pendingMove) return world;
      return {
        ...world,
        position: {
          x: world.position.x + world.pendingMove.x,
          y: world.position.y + world.pendingMove.y,
        },
        pendingMove: null,
      };
    }

    case "COMPLETE":
      // Finish whatever was running and return to a stable state.
      // Drops any unreleased pendingMove — defensive against commands
      // whose audio lifecycle never resolved (safety timer fired but
      // COMPLETE still reached before APPLY_MOVEMENT was dispatched).
      if (
        world.state === "EXECUTING" ||
        world.state === "SPEAKING" ||
        world.state === "THINKING" ||
        world.state === "CONFUSED"
      ) {
        return { ...world, state: "IDLE", pendingMove: null };
      }
      return world;

    case "ERROR":
      // Friendly confusion path — no raw errors exposed.
      return { ...world, state: "CONFUSED" };

    case "PAUSE":
      return { ...world, state: "PAUSED", paused: true };

    case "RETURN_TO_EXECUTION":
      // Reverts SPEAKING → EXECUTING without changing position. Two
      // callers:
      //   1. Action commands (WALK/JUMP/DANCE/CELEBRATE/GREET/
      //      SAY_GOODBYE) — fired by ingestSpeechEvent after
      //      SPEECH_ENDED, so the action animation (walking/dancing/
      //      celebrating/etc.) plays out visibly before COMPLETE.
      //   2. Content commands (TELL_JOKE/etc) — sentinel that does
      //      nothing for non-action commands; the COMPLETE event
      //      will drive the queue to IDLE soon after.
      // `lastCommand` is preserved by `...world`, so the
      // command-aware sprite mapping keeps working.
      if (world.state === "SPEAKING") {
        return { ...world, state: "EXECUTING" };
      }
      return world;

    case "RESUME":
      return { ...world, state: "IDLE", paused: false };

    case "RESET":
      return { ...initialWorld, state: "IDLE" };
  }
}

/**
 * Convenience helper to apply a command and run the typical lifecycle:
 * EXECUTE -> COMPLETE. Returns the world after both transitions.
 */
export function runCommand(
  world: RobiWorld,
  command: RobiCommand,
  onIntermediate?: (w: RobiWorld) => void
): RobiWorld {
  const during = reduceWorld(world, { type: "EXECUTE", command });
  onIntermediate?.(during);
  return reduceWorld(during, { type: "COMPLETE" });
}
