// Sprite sheet for the /control face badge.
// 10 columns × 1 row, 1300×110 px total. Each cell is 130×110 — a single
// ROBI head/face, no body. Unlike the /display sprite (which animates
// state via keyframes), these are state-LOCKED: one cell per state,
// no animation needed because the face itself encodes the state.
//
// See the README "Acciones que no son movimiento" section for the
// mapping rationale.
import type { RobiState } from "@/types/robi";

export const CONTROL_SPRITE_IMAGE_WIDTH = 1300;
export const CONTROL_SPRITE_IMAGE_HEIGHT = 110;
export const CONTROL_SPRITE_COLUMNS = 10;
export const CONTROL_SPRITE_ROWS = 1;

export const CONTROL_SPRITE_CELL_WIDTH =
  CONTROL_SPRITE_IMAGE_WIDTH / CONTROL_SPRITE_COLUMNS; // 130
export const CONTROL_SPRITE_CELL_HEIGHT =
  CONTROL_SPRITE_IMAGE_HEIGHT / CONTROL_SPRITE_ROWS; // 110

/** Cell index in the sprite sheet (0-based, left to right). */
export const FACE_COL = {
  NORMAL: 0,
  HAPPY: 1,
  VERY_HAPPY: 2,
  SURPRISED: 3,
  THINKING: 4,
  SAD: 5,
  WINK: 6,
  LAUGHING: 7,
  CONFUSED: 8,
  SLEEPING: 9,
} as const;

/** Reverse lookup: cell index → face name. Useful for tests. */
export const FACE_BY_COL: readonly string[] = [
  "NORMAL",
  "HAPPY",
  "VERY_HAPPY",
  "SURPRISED",
  "THINKING",
  "SAD",
  "WINK",
  "LAUGHING",
  "CONFUSED",
  "SLEEPING",
];

/**
 * Map app state to face cell. See README for the mapping rationale —
 * short version: state tells you WHAT the robot is doing, the face shows
 * how the robot looks while doing it. We re-use a few faces (NORMAL
 * for IDLE and EXECUTING; SLEEPING for both SLEEPING and PAUSED)
 * because the app state is already shown in the text below the badge.
 */
export const STATE_TO_FACE_COL: Record<RobiState, number> = {
  IDLE: FACE_COL.NORMAL,
  LISTENING: FACE_COL.SURPRISED,
  THINKING: FACE_COL.THINKING,
  SPEAKING: FACE_COL.HAPPY,
  EXECUTING: FACE_COL.NORMAL,
  CONFUSED: FACE_COL.CONFUSED,
  CELEBRATING: FACE_COL.VERY_HAPPY,
  SLEEPING: FACE_COL.SLEEPING,
  PAUSED: FACE_COL.SLEEPING,
};

/**
 * Compute the inline style for a face badge of the given width.
 * Background-size scales the whole 10×1 sheet so each cell becomes
 * `cellWidth` px wide. Background-position picks the right cell.
 */
export function faceBadgeStyle(cellWidth: number): React.CSSProperties {
  const cellHeight = cellWidth * (CONTROL_SPRITE_CELL_HEIGHT / CONTROL_SPRITE_CELL_WIDTH);
  return {
    width: cellWidth,
    height: cellHeight,
    backgroundImage: "url(/control-sprites.webp)",
    backgroundRepeat: "no-repeat",
    backgroundSize: `${CONTROL_SPRITE_COLUMNS * cellWidth}px ${cellHeight}px`,
  };
}

/**
 * Compute the background-position to show the cell for the given
 * RobiState. Returns { x, y } in CSS px units (negative to scroll the
 * background toward the right, since background-origin is top-left).
 */
export function faceBackgroundPosition(
  state: RobiState,
  cellWidth: number
): { backgroundPositionX: string; backgroundPositionY: string } {
  const col = STATE_TO_FACE_COL[state];
  return {
    backgroundPositionX: `${-col * cellWidth}px`,
    backgroundPositionY: "0",
  };
}