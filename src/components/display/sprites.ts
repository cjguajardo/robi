// Sprite sheet metadata for the /display avatar.
//
// One source of truth: the layout the user described, the math for picking
// cells, the CSS keyframes per track, and the RobiState → track mapping.
//
// Pixel offsets are returned in the SCALED coordinate system (one cell
// equals `ctx.cellWidth × ctx.cellHeight`). The avatar component passes
// the render context so background-size and offsets use the same units.
//
// Animation strategy:
// - Each track has N frames laid out left-to-right in its row.
// - We emit a `@keyframes sprite-<id>` rule that holds each cell for
//   100/N percent of the duration. Same value at consecutive keyframe
//   percentages → no interpolation → discrete frame cycling.
// - The component applies the matching animation rule via [data-anim].

import type { Direction, RobiCommand, RobiState } from "@/types/robi";

// ---------------------------------------------------------------------------
// Physical layout — matches the display-sprites.webp shipped in the repo.
// ---------------------------------------------------------------------------

export const SPRITE_IMAGE_WIDTH = 1900;
export const SPRITE_IMAGE_HEIGHT = 976;
export const SPRITE_COLUMNS = 10;
export const SPRITE_ROWS = 4;

export const SPRITE_CELL_WIDTH = SPRITE_IMAGE_WIDTH / SPRITE_COLUMNS;
export const SPRITE_CELL_HEIGHT = SPRITE_IMAGE_HEIGHT / SPRITE_ROWS;

// ---------------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------------

/** Render context — display size of one sprite cell. */
export interface SpriteContext {
  cellWidth: number;
  cellHeight: number;
}

/** A single animation track — a strip of N cells in one row. */
export interface SpriteTrack {
  /** Unique CSS-safe identifier. Used for keyframe name + data-anim. */
  id: string;
  /** Row index (0-based) on the sprite sheet. */
  row: number;
  /** First column index of the strip. */
  startCol: number;
  /** Number of cells in the strip. */
  frameCount: number;
  /** Animation duration in seconds (one full cycle). */
  duration: number;
  /** Whether the track repeats. Defaults to true for ambient/action loops. */
  loop?: boolean;
  /**
   * Optional weighted frame sequence. Defaults to evenly cycling
   * 0..frameCount-1. Custom sequences let a track hold (or skip)
   * specific cells — JUMP uses `[0, 1, 1, 2, 2, 0]` to emulate a
   * real jump (crouch → push-off → mid-air → apex → apex → land).
   *
   * With `step-end` timing, duplicated indices produce a HOLD
   * (the start and end value are identical so the segment snaps
   * to nothing). Use this for animations where some poses should
   * linger longer than one segment.
   */
  frameSequence?: readonly number[];
}

// ---------------------------------------------------------------------------
// Track catalog.
// ---------------------------------------------------------------------------

/**
 * Each track is the strip of cells the user described. Keep the rows and
 * startCol values in sync with `ROBI — State Descriptions`.
 *
 * Durations are tuned for kid-friendly pacing — slow for sleep/idle,
 * fast for action loops.
 */
export const SPRITE_TRACKS: Record<string, SpriteTrack> = {
  idle:        { id: "idle",        row: 0, startCol: 0, frameCount: 1, duration: 1.8 },
  sleeping:    { id: "sleeping",    row: 0, startCol: 3, frameCount: 3, duration: 2.4 },
  wakeup:      { id: "wakeup",      row: 0, startCol: 7, frameCount: 3, duration: 1.0 },
  listening:   { id: "listening",   row: 1, startCol: 0, frameCount: 3, duration: 1.4 },
  thinking:    { id: "thinking",    row: 1, startCol: 3, frameCount: 4, duration: 1.6 },
  speaking:    { id: "speaking",    row: 1, startCol: 7, frameCount: 3, duration: 0.45 },
  walking:     { id: "walking",     row: 2, startCol: 0, frameCount: 4, duration: 0.7 },
  waving:      { id: "waving",      row: 2, startCol: 4, frameCount: 3, duration: 0.9 },
  happy:       { id: "happy",       row: 2, startCol: 7, frameCount: 1, duration: 0.0 },
  confused:    { id: "confused",    row: 2, startCol: 8, frameCount: 2, duration: 0.6 },
  dancing:     { id: "dancing",     row: 3, startCol: 0, frameCount: 6, duration: 0.55 },
  celebrating: { id: "celebrating", row: 3, startCol: 6, frameCount: 4, duration: 0.5 },
  paused:      { id: "sleeping",    row: 0, startCol: 3, frameCount: 3, duration: 2.4 },
// Jump — row 1, cells 0/1/2 = crouch / push-off / apex. Custom weighted
  // cycle [0, 1, 1, 2, 2, 0] emulates a real jump:
  //   segment 1 (0   → 16.67%) crouch
  //   segment 2 (16  → 33%   ) push-off
  //   segment 3 (33  → 50%   ) held mid-air
  //   segment 4 (50  → 67%   ) apex (held)
  //   segment 5 (67  → 83%   ) falling
  //   segment 6 (83  → 100%  ) landed
  // With step-end timing, duplicated indices ("1, 1" and "2, 2") HOLD
  // the same cell for the segment duration → real-jump cadence.
  // Vertical lift comes from CSS `avatar-jump` translateY keyframes
  // (also 6-segment, aligned with the sprite cycle).
  jumping:     { id: "jumping", row: 0, startCol: 0, frameCount: 3, duration: 0.7, loop: false, frameSequence: [0, 1, 1, 2, 2, 0] },
};

// ---------------------------------------------------------------------------
// Avatar orientation.
// ---------------------------------------------------------------------------

/**
 * CSS transform per cardinal direction — how to "face" each direction.
 *
 * The sprite is drawn facing the audience (south) and is mostly symmetric
 * left↔right but not front↔back (the face is on the front). To make ROBI
 * "look" where it's going we use:
 *
 *   - **SOUTH** (default): no transform. Sprite as drawn, faces audience.
 *   - **EAST** (right):   `scaleX(1)` (no flip). The sprite's right side
 *                          is on screen's right side → it appears to face
 *                          right. Same trick classic 2D platformers use.
 *   - **WEST** (left):    `scaleX(-1)`. Horizontal mirror — the sprite's
 *                          right side flips to screen's left, so it
 *                          reads as facing left. No dedicated left-facing
 *                          sprite needed; the animation still cycles
 *                          because scaleX composes with the keyframes
 *                          on the inner `.avatar-sprite`.
 *   - **NORTH** (away):   `rotate(180deg)`. The back of the sprite is on
 *                          screen's front — used when the kid has turned
 *                          ROBI around multiple times.
 *
 * Why not pure Z-axis rotation for EAST/WEST: a 90°/270° CSS rotate spins
 * the sprite in the screen plane, making it look like ROBI is LYING DOWN,
 * not walking sideways. That was the bug — kid sees a toppled robot. The
 * mirror (scaleX) is the kid-platformer convention for "facing the other
 * way" and reads instantly even at 240×360.
 */
export const DIRECTION_TRANSFORM: Record<Direction, string> = {
  NORTH: "rotate(180deg)",
  EAST: "scaleX(1)",
  SOUTH: "",
  WEST: "scaleX(-1)",
};

// ---------------------------------------------------------------------------
// Geometry.
// ---------------------------------------------------------------------------

/**
 * Compute the background-position for a given frame of a track.
 * The returned offsets are in the SCALED coordinate system (one cell =
 * `ctx.cellWidth × ctx.cellHeight`). Pair with `background-size: (cols *
 * cellWidth)px (rows * cellHeight)px` on the avatar container.
 */
export function frameBackgroundPosition(
  track: SpriteTrack,
  frameIndex: number,
  ctx: SpriteContext,
): { x: number; y: number } {
  const col = track.startCol + frameIndex;
  // Normalize the zero case so callers get `0` rather than `-0`
  // (vitest's toEqual uses Object.is, which distinguishes the two).
  const xRaw = -col * ctx.cellWidth;
  const yRaw = -track.row * ctx.cellHeight;
  return {
    x: xRaw === 0 ? 0 : xRaw,
    y: yRaw === 0 ? 0 : yRaw,
  };
}

// ---------------------------------------------------------------------------
// State → track mapping.
// ---------------------------------------------------------------------------

/**
 * Pick the sprite track for the current world state.
 *
 * `EXECUTING` is generic — the server broadcasts the underlying command
 * separately (in `COMMAND` events, see server.ts drainQueue). When we
 * know the command, we pick the most expressive track:
 *   - MOVE_*        → walking
 *   - GREET         → waving
 *   - DANCE         → dancing
 *   - CELEBRATE     → celebrating
 *   - UNKNOWN       → confused
 *   - everything else (TURN_*, STOP, RESET) → idle (the body turns/rotates
 *     via the parent transform; we don't have dedicated frames for them).
 *
 * Without a command we fall back to walking so the first frame of an
 * EXECUTING transition still shows movement (server may emit STATE_CHANGED
 * before COMMAND is wired through; harmless one-frame flicker otherwise).
 */
export function spriteTrackFor(state: RobiState, command?: RobiCommand): SpriteTrack {
  switch (state) {
    case "SLEEPING":
      return SPRITE_TRACKS.sleeping;
    case "IDLE":
      return SPRITE_TRACKS.idle;
    case "LISTENING":
      return SPRITE_TRACKS.listening;
    case "THINKING":
      return SPRITE_TRACKS.thinking;
    case "SPEAKING":
      return SPRITE_TRACKS.speaking;
    case "CELEBRATING":
      return SPRITE_TRACKS.celebrating;
    case "CONFUSED":
      return SPRITE_TRACKS.confused;
    case "PAUSED":
      return SPRITE_TRACKS.paused;
    case "EXECUTING": {
      if (!command) return SPRITE_TRACKS.walking;
      switch (command.type) {
        case "WALK_LEFT":
        case "WALK_RIGHT":
          return SPRITE_TRACKS.walking;
        case "JUMP":
          return SPRITE_TRACKS.jumping;
        case "GREET":
          return SPRITE_TRACKS.waving;
        case "DANCE":
          return SPRITE_TRACKS.dancing;
        case "CELEBRATE":
          return SPRITE_TRACKS.celebrating;
        case "TELL_JOKE":
        case "TELL_FACT":
          return SPRITE_TRACKS.speaking;
        case "TELL_RIDDLE":
          return SPRITE_TRACKS.thinking;
        case "ANSWER_QUESTION":
          // Hand on chin while we wait for the LLM to answer.
          return SPRITE_TRACKS.thinking;
        case "SAY_GOODBYE":
          return SPRITE_TRACKS.waving;
        case "STOP":
        case "RESET":
          return SPRITE_TRACKS.idle;
        case "UNKNOWN":
          return SPRITE_TRACKS.confused;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CSS generation.
// ---------------------------------------------------------------------------

/**
 * Build a `@keyframes sprite-<id> { ... }` rule that cycles through every
 * frame of the track.
 *
 * Pattern:
 * - One keyframe per cell at `i * 100/N %` — these are the *cell shows*.
 * - An extra keyframe at `100%` with cell 0's position — this closes the
 *   loop so the last segment's end value matches the first segment's
 *   start value (clean repetition, no flash on loop).
 *
 * Timing is `step-end` (see generateAnimationRule). step-end holds the
 * START value of each segment for the full segment duration, then jumps
 * to the END value at the segment boundary. Combined with one keyframe
 * per cell, each cell is held for `100/N %` of the duration with a crisp
 * jump to the next — exactly the "show frame → pause → jump → next frame"
 * cycle the user asked for, no slide.
 *
 * If the track has a custom `frameSequence`, the keyframes are emitted
 * using those indices instead of an even 0..N-1 cycle. Duplicated
 * indices in the sequence produce HOLDS (start==end → no step). JUMP
 * uses `[0, 1, 1, 2, 2, 0]` to emulate a real jump.
 *
 * Single-frame tracks emit a degenerate `from, to` rule.
 */
export function generateKeyframes(track: SpriteTrack, ctx: SpriteContext = { cellWidth: 240, cellHeight: 360 }): string {
  if (track.frameCount <= 1) {
    const pos = frameBackgroundPosition(track, 0, ctx);
    return [
      `@keyframes sprite-${track.id} {`,
      `  from, to { background-position: ${pos.x.toFixed(2)}px ${pos.y.toFixed(2)}px; }`,
      `}`,
    ].join("\n");
  }

  const lines: string[] = [`@keyframes sprite-${track.id} {`];

  // Custom weighted sequence: weight by sequence length, not frameCount.
  if (track.frameSequence && track.frameSequence.length > 0) {
    const seq = track.frameSequence;
    const segCount = seq.length;
    const segPct = 100 / segCount;
    for (let i = 0; i < segCount; i++) {
      const frameIdx = seq[i];
      const pos = frameBackgroundPosition(track, frameIdx, ctx);
      const pct = (i * segPct).toFixed(2);
      lines.push(
        `  ${pct}% { background-position: ${pos.x.toFixed(2)}px ${pos.y.toFixed(2)}px; }`,
      );
    }
    // Close the loop with the sequence's first frame.
    const firstPos = frameBackgroundPosition(track, seq[0], ctx);
    lines.push(
      `  ${(100).toFixed(2)}% { background-position: ${firstPos.x.toFixed(2)}px ${firstPos.y.toFixed(2)}px; }`,
    );
    lines.push(`}`);
    return lines.join("\n");
  }

  // Default: one keyframe per cell, evenly spaced.
  const N = track.frameCount;
  const cellPct = 100 / N;

  // One keyframe per cell, evenly spaced.
  for (let i = 0; i < N; i++) {
    const pos = frameBackgroundPosition(track, i, ctx);
    const pct = ((i * cellPct)).toFixed(2);
    lines.push(
      `  ${pct}% { background-position: ${pos.x.toFixed(2)}px ${pos.y.toFixed(2)}px; }`,
    );
  }

  // Close the loop: 100% keyframe holds cell 0's position so the last
  // segment's end value matches the first segment's start value.
  const firstPos = frameBackgroundPosition(track, 0, ctx);
  lines.push(
    `  ${(100).toFixed(2)}% { background-position: ${firstPos.x.toFixed(2)}px ${firstPos.y.toFixed(2)}px; }`,
  );

  lines.push(`}`);
  return lines.join("\n");
}

/**
 * Build the `animation` shorthand for a track.
 *
 * Why `step-end` and not `linear` or `steps(N)`:
 *
 * - `linear` interpolates between adjacent keyframes. With one keyframe per
 *   cell, that's exactly the slide the user wants to avoid — the sprite
 *   sheet would pan between cells instead of jumping.
 *
 * - `steps(N)` samples the *overall* start-to-end interpolation at N points
 *   and ignores intermediate keyframes. The samples land in the middle of
 *   cells (-880px instead of -960px for sleeping) and produce slides.
 *
 * - `step-end` (equivalent to `steps(1, jump-end)`) holds the START value
 *   of each segment for the full segment, then jumps to the END value at
 *   the boundary. With one keyframe per cell, each cell is held for
 *   `100/N %` of the duration with a crisp jump to the next — exactly
 *   "show frame → pause → jump → next frame".
 */
export function generateAnimationRule(track: SpriteTrack): string {
  if (track.frameCount <= 1) {
    return `sprite-${track.id} 1s linear infinite`;
  }
  const repetition = track.loop === false ? "1 both" : "infinite";
  return `sprite-${track.id} ${track.duration.toFixed(2)}s step-end ${repetition}`;
}

/**
 * Build a stylesheet that wires up the avatar container for sprite
 * rendering. The avatar injects this once at mount and toggles `data-anim`
 * to switch tracks.
 */
export function generateAvatarStylesheet(ctx: SpriteContext): string {
  const totalWidth = SPRITE_COLUMNS * ctx.cellWidth;
  const totalHeight = SPRITE_ROWS * ctx.cellHeight;

  const keyframes = Object.values(SPRITE_TRACKS)
    .map((track) => generateKeyframes(track, ctx))
    .join("\n");

  const animationRules = Object.values(SPRITE_TRACKS)
    .map(
      (track) =>
        `.avatar-sprite[data-anim="${track.id}"] { animation: ${generateAnimationRule(track)}; }`,
    )
    .join("\n");

  return [
    `.avatar-sprite {`,
    `  width: ${ctx.cellWidth}px;`,
    `  height: ${ctx.cellHeight}px;`,
    `  background-image: url('/display-sprites.webp');`,
    `  background-size: ${totalWidth}px ${totalHeight}px;`,
    `  background-repeat: no-repeat;`,
    `  background-position: 0 0;`,
    `  will-change: background-position;`,
    `}`,
    animationRules,
    keyframes,
  ].join("\n");
}
