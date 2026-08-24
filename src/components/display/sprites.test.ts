// Sprite metadata — single source of truth for the /display avatar.
// See sprites.ts for the implementation and the layout described in
// `ROBI — State Descriptions`.
//
// TDD note: this file is written FIRST. The implementation in sprites.ts
// must satisfy every test below. Add a test before adding behavior.

import { describe, expect, it } from "vitest";
import {
  SPRITE_IMAGE_WIDTH,
  SPRITE_IMAGE_HEIGHT,
  SPRITE_COLUMNS,
  SPRITE_ROWS,
  SPRITE_CELL_WIDTH,
  SPRITE_CELL_HEIGHT,
  SPRITE_TRACKS,
  DIRECTION_TRANSFORM,
  frameBackgroundPosition,
  spriteTrackFor,
  generateKeyframes,
  generateAnimationRule,
  type SpriteContext,
  type SpriteTrack,
} from "./sprites";
import type { RobiCommand, RobiState } from "@/types/robi";

/** Reference render context — what the /display avatar passes. */
const CTX: SpriteContext = { cellWidth: 240, cellHeight: 360 };

describe("sprite grid — physical layout", () => {
  it("matches the PNG dimensions and 10×4 grid the user provided", () => {
    expect(SPRITE_IMAGE_WIDTH).toBe(1900);
    expect(SPRITE_IMAGE_HEIGHT).toBe(976);
    expect(SPRITE_COLUMNS).toBe(10);
    expect(SPRITE_ROWS).toBe(4);
  });

  it("derives cell size from the image", () => {
    expect(SPRITE_CELL_WIDTH).toBeCloseTo(1900 / 10, 5);
    expect(SPRITE_CELL_HEIGHT).toBe(976 / 4);
  });
});

describe("sprite tracks — catalog of animations", () => {
  it("declares one track per state we render", () => {
    // Every RobiState must map to a track — covered by spriteTrackFor tests,
    // but we also guard against orphan tracks being missing.
    const expectedIds = [
      "idle",
      "sleeping",
      "wakeup",
      "listening",
      "thinking",
      "speaking",
      "walking",
      "waving",
      "happy",
      "confused",
      "dancing",
      "celebrating",
      "paused",
    ];
    for (const id of expectedIds) {
      expect(SPRITE_TRACKS[id]).toBeDefined();
    }
  });

  it("every track fits within the sprite grid", () => {
    for (const track of Object.values(SPRITE_TRACKS)) {
      expect(track.row).toBeGreaterThanOrEqual(0);
      expect(track.row).toBeLessThan(SPRITE_ROWS);
      expect(track.startCol).toBeGreaterThanOrEqual(0);
      expect(track.startCol + track.frameCount).toBeLessThanOrEqual(SPRITE_COLUMNS);
      expect(track.frameCount).toBeGreaterThanOrEqual(1);
      // Single-frame tracks don't cycle; duration is moot for them.
      if (track.frameCount > 1) {
        expect(track.duration).toBeGreaterThan(0);
      }
    }
  });

  it("matches the layout the user described (row → columns)", () => {
    // Row 0: IDLE 0, SLEEPING 3-5, WAKEUP 7-9
    // (IDLE is a single static frame after the recent sprite sheet redesign.)
    expect(SPRITE_TRACKS.idle).toMatchObject({ row: 0, startCol: 0, frameCount: 1 });
    expect(SPRITE_TRACKS.sleeping).toMatchObject({ row: 0, startCol: 3, frameCount: 3 });
    expect(SPRITE_TRACKS.wakeup).toMatchObject({ row: 0, startCol: 7, frameCount: 3 });

    // Row 1: LISTENING 0-2, THINKING 3-6, SPEAKING 7-9
    expect(SPRITE_TRACKS.listening).toMatchObject({ row: 1, startCol: 0, frameCount: 3 });
    expect(SPRITE_TRACKS.thinking).toMatchObject({ row: 1, startCol: 3, frameCount: 4 });
    expect(SPRITE_TRACKS.speaking).toMatchObject({ row: 1, startCol: 7, frameCount: 3 });

    // Row 2: WALKING 0-3, WAVING 4-6, HAPPY 7, CONFUSED 8-9
    expect(SPRITE_TRACKS.walking).toMatchObject({ row: 2, startCol: 0, frameCount: 4 });
    expect(SPRITE_TRACKS.waving).toMatchObject({ row: 2, startCol: 4, frameCount: 3 });
    expect(SPRITE_TRACKS.happy).toMatchObject({ row: 2, startCol: 7, frameCount: 1 });
    expect(SPRITE_TRACKS.confused).toMatchObject({ row: 2, startCol: 8, frameCount: 2 });

    // Row 3: DANCING 0-5, CELEBRATING 6-9
    expect(SPRITE_TRACKS.dancing).toMatchObject({ row: 3, startCol: 0, frameCount: 6 });
    expect(SPRITE_TRACKS.celebrating).toMatchObject({ row: 3, startCol: 6, frameCount: 4 });
  });
});

describe("frameBackgroundPosition — pixel offsets", () => {
  it("returns the natural (no-op) offset for the first frame", () => {
    const track: SpriteTrack = SPRITE_TRACKS.walking;
    expect(frameBackgroundPosition(track, 0, CTX)).toEqual({ x: 0, y: -2 * CTX.cellHeight });
  });

  it("steps horizontally by cellWidth for each subsequent frame", () => {
    const track: SpriteTrack = SPRITE_TRACKS.walking; // startCol 0
    expect(frameBackgroundPosition(track, 1, CTX)).toEqual({
      x: -1 * CTX.cellWidth,
      y: -2 * CTX.cellHeight,
    });
    expect(frameBackgroundPosition(track, 3, CTX)).toEqual({
      x: -3 * CTX.cellWidth,
      y: -2 * CTX.cellHeight,
    });
  });

  it("respects startCol when computing horizontal offset", () => {
    const track: SpriteTrack = SPRITE_TRACKS.thinking; // startCol 3
    expect(frameBackgroundPosition(track, 0, CTX)).toEqual({
      x: -3 * CTX.cellWidth,
      y: -1 * CTX.cellHeight,
    });
    expect(frameBackgroundPosition(track, 1, CTX)).toEqual({
      x: -4 * CTX.cellWidth,
      y: -1 * CTX.cellHeight,
    });
  });
});

describe("DIRECTION_TRANSFORM — avatar orientation", () => {
  it("keeps the default direction (SOUTH) untransformed — sprite faces the audience", () => {
    // initialWorld.direction = "SOUTH" — out of the box the avatar must
    // be upright, not flipped. The sprite sheet is drawn facing the
    // viewer with no transform applied.
    expect(DIRECTION_TRANSFORM.SOUTH).toBe("");
  });

  it("mirrors the sprite horizontally for WEST (facing left) instead of rotating", () => {
    // The previous implementation used a 270° CSS rotate, which spun the
    // sprite in the screen plane — the kid saw a toppled robot, not a
    // robot facing left. scaleX(-1) is the 2D-platformer convention for
    // "facing the other way" and reads instantly even at 240×360.
    expect(DIRECTION_TRANSFORM.WEST).toBe("scaleX(-1)");
  });

  it("does NOT mirror for EAST (facing right) — the sprite as drawn already faces the audience and reads as 'right' when not flipped", () => {
    expect(DIRECTION_TRANSFORM.EAST).toBe("scaleX(1)");
  });

  it("rotates 180° for NORTH (back of head — rare; reached only after multiple turns)", () => {
    expect(DIRECTION_TRANSFORM.NORTH).toBe("rotate(180deg)");
  });

  it("covers every cardinal direction", () => {
    expect(Object.keys(DIRECTION_TRANSFORM).sort()).toEqual(["EAST", "NORTH", "SOUTH", "WEST"]);
  });
});

describe("spriteTrackFor — state → track mapping", () => {
  it("handles every RobiState", () => {
    const states: RobiState[] = [
      "SLEEPING",
      "IDLE",
      "LISTENING",
      "THINKING",
      "SPEAKING",
      "EXECUTING",
      "CELEBRATING",
      "CONFUSED",
      "PAUSED",
    ];
    for (const state of states) {
      const track = spriteTrackFor(state);
      expect(track).toBeDefined();
      expect(track.id).toBeTypeOf("string");
    }
  });

  it("SLEEPING → sleeping frames", () => {
    expect(spriteTrackFor("SLEEPING").id).toBe("sleeping");
  });

  it("IDLE → idle frames", () => {
    expect(spriteTrackFor("IDLE").id).toBe("idle");
  });

  it("LISTENING → listening frames", () => {
    expect(spriteTrackFor("LISTENING").id).toBe("listening");
  });

  it("THINKING → thinking frames", () => {
    expect(spriteTrackFor("THINKING").id).toBe("thinking");
  });

  it("SPEAKING → speaking frames", () => {
    expect(spriteTrackFor("SPEAKING").id).toBe("speaking");
  });

  it("CELEBRATING → celebrating frames", () => {
    expect(spriteTrackFor("CELEBRATING").id).toBe("celebrating");
  });

  it("CONFUSED → confused frames", () => {
    expect(spriteTrackFor("CONFUSED").id).toBe("confused");
  });

  it("PAUSED → sleeping (dimmed) so the robot looks frozen", () => {
    expect(spriteTrackFor("PAUSED").id).toBe("sleeping");
  });

  describe("EXECUTING → depends on command", () => {
    const cases: Array<{ cmd: RobiCommand; expectedId: string }> = [
      { cmd: { type: "WALK_LEFT", steps: 1 }, expectedId: "walking" },
      { cmd: { type: "WALK_RIGHT", steps: 1 }, expectedId: "walking" },
      { cmd: { type: "STOP" }, expectedId: "idle" },
      { cmd: { type: "GREET" }, expectedId: "waving" },
      { cmd: { type: "DANCE" }, expectedId: "dancing" },
      { cmd: { type: "CELEBRATE" }, expectedId: "celebrating" },
      { cmd: { type: "RESET" }, expectedId: "idle" },
      { cmd: { type: "UNKNOWN", raw: "x" }, expectedId: "confused" },
    ];

    for (const { cmd, expectedId } of cases) {
      it(`maps ${cmd.type} → ${expectedId}`, () => {
        expect(spriteTrackFor("EXECUTING", cmd).id).toBe(expectedId);
      });
    }

    it("falls back to walking when no command is provided", () => {
      expect(spriteTrackFor("EXECUTING").id).toBe("walking");
    });
  });
});

describe("generateKeyframes — CSS output", () => {
  it("emits a @keyframes block named after the track", () => {
    const kf = generateKeyframes(SPRITE_TRACKS.walking);
    expect(kf).toMatch(/^@keyframes sprite-walking \{/);
  });

  it("produces one keyframe per cell, evenly spaced, plus 100% loop-back", () => {
    const kf = generateKeyframes(SPRITE_TRACKS.walking); // 4 frames
    // 4 cells at 0%, 25%, 50%, 75% + 100% loop back to cell 0
    expect(kf).toContain("0.00%");
    expect(kf).toContain("25.00%");
    expect(kf).toContain("50.00%");
    expect(kf).toContain("75.00%");
    expect(kf).toContain("100.00%");
  });

  it("uses background-position with px units", () => {
    const kf = generateKeyframes(SPRITE_TRACKS.walking);
    expect(kf).toMatch(/background-position: [\-\d.]+px [\-\d.]+px/);
  });

  it("encodes frame 0 at offset (0, -row*cellHeight)", () => {
    const kf = generateKeyframes(SPRITE_TRACKS.walking, CTX);
    const yOffset = (2 * CTX.cellHeight).toFixed(2);
    expect(kf).toContain(`background-position: 0.00px -${yOffset}px`);
  });

  it("handles single-frame tracks with from/to", () => {
    const kf = generateKeyframes(SPRITE_TRACKS.happy, CTX);
    expect(kf).toMatch(/from, to/);
  });

  it("emits distinct keyframes (not duplicated) so the browser doesn't interpolate between cells", () => {
    // Each cell gets ONE keyframe at `i * 100/N %`. The 100% keyframe loops
    // back to cell 0. step-end timing then holds each cell and jumps at
    // the boundary. Duplicated selectors (`0%, 33.33% { ... }`) DO NOT
    // work — the later rule wins for that percentage, which produces a
    // slide between cells under linear/ease timing.
    const kf = generateKeyframes(SPRITE_TRACKS.walking, CTX);
    expect(kf).not.toMatch(/0\.00%, 25\.00%/);
    expect(kf).not.toMatch(/25\.00%, 50\.00%/);
    expect(kf).not.toMatch(/50\.00%, 75\.00%/);
    expect(kf).not.toMatch(/75\.00%, 100\.00%/);
    // Frame 0 appears exactly twice: at 0% (start) and at 100% (loop back).
    const cellZeroMatches = kf.match(/background-position: 0\.00px -720\.00px;/g) ?? [];
    expect(cellZeroMatches.length).toBe(2);
  });

  it("each cell appears at an evenly-spaced percentage", () => {
    // Walking has 4 frames → cells at 0%, 25%, 50%, 75%
    const kf = generateKeyframes(SPRITE_TRACKS.walking, CTX);
    expect(kf).toMatch(/0\.00% \{ background-position: 0\.00px -720\.00px/);
    expect(kf).toMatch(/25\.00% \{ background-position: -240\.00px -720\.00px/);
    expect(kf).toMatch(/50\.00% \{ background-position: -480\.00px -720\.00px/);
    expect(kf).toMatch(/75\.00% \{ background-position: -720\.00px -720\.00px/);
    expect(kf).toMatch(/100\.00% \{ background-position: 0\.00px -720\.00px/);
  });

  it("100% loops back to cell 0 for clean repetition", () => {
    // For sleeping (3 cells), 100% should hold the FIRST cell's position.
    const kf = generateKeyframes(SPRITE_TRACKS.sleeping, CTX);
    // Cell 0 (col 3) at -720px. The loop-back 100% keyframe must use the same.
    expect(kf).toMatch(/100\.00% \{ background-position: -720\.00px 0\.00px/);
  });

  it("custom frameSequence emits one keyframe per sequence element, weighted by seq length", () => {
    // JUMP uses [0, 1, 1, 2, 2, 0] — 6 entries over a row of 3 cells.
    // With step-end timing, duplicated indices produce HOLDS (start==end).
    // After the recent sprite sheet redesign JUMP lives on row 0 (same
    // cells as IDLE); the keyframe math is the same, only the y-offset
    // changes (row 0 → y=0 instead of -360).
    const kf = generateKeyframes(SPRITE_TRACKS.jumping, CTX);
    // Sequence has 6 entries — 6 keyframes at 0%, 16.67%, 33.33%, 50%, 66.67%, 83.33%
    expect(kf).toMatch(/@keyframes sprite-jumping \{/);
    expect(kf).toMatch(/16\.67% \{ background-position: -240\.00px 0\.00px/); // frame 1 (push-off)
    expect(kf).toMatch(/33\.33% \{ background-position: -240\.00px 0\.00px/); // frame 1 (HOLD)
    expect(kf).toMatch(/50\.00% \{ background-position: -480\.00px 0\.00px/); // frame 2 (apex)
    // Loop-back 100% must equal the sequence's first frame (0 = cell at row0 col0).
    expect(kf).toMatch(/100\.00% \{ background-position: 0\.00px 0\.00px/);
  });

  it("frameSequence indices reference cells in [startCol, startCol+frameCount)", () => {
    // Verify the cell-coordinate math. After the recent sprite sheet
    // redesign jumping moved from row 1 to row 0 (same cells as IDLE),
    // so the y-offset is 0 instead of -360.
    const kf = generateKeyframes(SPRITE_TRACKS.jumping, CTX);
    const lines = kf.split("\n").filter(l => l.includes("background-position"));
    expect(lines.length).toBeGreaterThanOrEqual(6); // 6 + loop-back
    // Each percentage in 0%..83.33% maps to a distinct cell.
    const positions = lines.map(l => {
      const m = l.match(/background-position: (-?\d+\.\d+)px (-?\d+\.\d+)px/);
      return m ? m.slice(1, 3).join(",") : "";
    });
    // Sequence values: cell 0 → "0.00,0.00"; cell 1 → "-240.00,0.00"; cell 2 → "-480.00,0.00"
    const cell0 = positions.find(p => p === "0.00,0.00");
    const cell1 = positions.find(p => p === "-240.00,0.00");
    const cell2 = positions.find(p => p === "-480.00,0.00");
    expect(cell0).toBeDefined();
    expect(cell1).toBeDefined();
    expect(cell2).toBeDefined();
  });
});

describe("generateAnimationRule — CSS animation shorthand", () => {
  it("returns an animation string the browser can apply", () => {
    const rule = generateAnimationRule(SPRITE_TRACKS.walking);
    expect(rule).toMatch(/^sprite-walking [\d.]+s step-end/);
    // animation: <name> <duration> <timing> <iteration>
    expect(rule).toContain("infinite");
  });

  it("includes duration matching the track", () => {
    expect(generateAnimationRule(SPRITE_TRACKS.walking)).toContain(
      `${SPRITE_TRACKS.walking.duration.toFixed(2)}s`,
    );
  });

  it("runs the JUMP sprite sequence exactly once", () => {
    const rule = generateAnimationRule(SPRITE_TRACKS.jumping);

    expect(rule).toContain("step-end 1 both");
    expect(rule).not.toContain("infinite");
  });

  it("uses step-end timing for multi-frame tracks (hold each cell, jump crisply)", () => {
    // step-end holds the START value of each segment, jumps to the END
    // value at the segment boundary. Combined with our one-keyframe-per-cell
    // pattern, each cell is held for 100/N% of duration with a crisp jump
    // and no slide.
    expect(generateAnimationRule(SPRITE_TRACKS.walking)).toContain("step-end");
    expect(generateAnimationRule(SPRITE_TRACKS.listening)).toContain("step-end");
    expect(generateAnimationRule(SPRITE_TRACKS.dancing)).toContain("step-end");
  });

  it("does NOT use linear for multi-frame tracks — it would slide between cells", () => {
    // With one-keyframe-per-cell (cell i at i*100/N %), linear timing
    // interpolates between adjacent cells → slide. step-end jumps.
    expect(generateAnimationRule(SPRITE_TRACKS.walking)).not.toContain("linear");
  });

  it("never uses steps() — it would slide between cells instead of jumping", () => {
    expect(generateAnimationRule(SPRITE_TRACKS.walking)).not.toContain("steps(");
    expect(generateAnimationRule(SPRITE_TRACKS.listening)).not.toContain("steps(");
    expect(generateAnimationRule(SPRITE_TRACKS.dancing)).not.toContain("steps(");
  });

  it("uses linear for single-frame tracks", () => {
    expect(generateAnimationRule(SPRITE_TRACKS.happy)).toContain("linear");
  });
});
