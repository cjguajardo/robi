// ROBI avatar — sprite-sheet based.
//
// The avatar is a single <div> with the sprite sheet as a background-image.
// Each animation track (idle, walking, dancing, etc.) is a strip of cells on
// the sheet. We swap which strip is showing by:
//   1. setting background-position to the right cell offset, and
//   2. setting data-anim so the matching @keyframes rule cycles through the
//      strip frames in steps(N) — discrete frame changes, no smoothing.
//
// The sprite metadata + CSS generation lives in ./sprites.ts. Tests live in
// ./sprites.test.ts.

import { useMemo } from "react";
import type { Direction, RobiCommand, RobiState } from "@/types/robi";
import {
  DIRECTION_TRANSFORM,
  generateAvatarStylesheet,
  spriteTrackFor,
  type SpriteContext,
} from "./sprites";

interface Props {
  state: RobiState;
  /** The command that triggered EXECUTING, when known. */
  command?: RobiCommand | null;
  /** Cardinal direction the avatar is facing. Drives the orientation transform. */
  direction?: Direction;
  /**
   * Monotonic counter that increments on each JUMP command. Used as a
   * React `key` to force a fresh mount of the avatar-wrap so the
   * `avatar-jump` CSS animation re-runs (CSS doesn't restart an
   * animation just because a className toggled — fresh mount does).
   */
  jumpKey?: number;
}

/** Display size of one sprite cell — matches .avatar-sprite CSS. */
const CTX: SpriteContext = { cellWidth: 240, cellHeight: 360 };

export function RobiAvatar({ state, command, direction = "SOUTH", jumpKey = 0 }: Props) {
  const track = useMemo(
    () => spriteTrackFor(state, command ?? undefined),
    [state, command],
  );

  // The stylesheet is the same across renders for a given CTX — memoized
  // so we don't re-inject it on every state change.
  const stylesheet = useMemo(() => generateAvatarStylesheet(CTX), []);

  const directionTransform = DIRECTION_TRANSFORM[direction];
  // Add `.jumping` class while a JUMP command is active. The animation
  // runs once per `jumpKey` change (see comment above). When the kid
  // presses JUMP again, Robi.tsx increments jumpKey → React re-mounts
  // this wrap → animation re-runs.
  const isJumping = command?.type === "JUMP";

  return (
    <>
      <style>{stylesheet}</style>
      {/* Outer scaler — responsive sizing via media queries (CSS).
          Middle wrap — direction transform (scaleX for lateral, rotate for
          NORTH; see DIRECTION_TRANSFORM in sprites.ts for the rationale).
          Inner sprite — background image + animation. The transform
          composes with the keyframe animation on the inner element, so
          the walking-arm-swing cycles even while mirrored. */}
      <div className="avatar-scaler" data-state={state.toLowerCase()}>
        <div
          // `key={jumpKey}` forces a fresh mount every JUMP so the CSS
          // translation animation restarts. No effect on non-JUMP
          // commands (jumpKey stays the same).
          key={`wrap-${jumpKey}`}
          className={`avatar-wrap${isJumping ? " jumping" : ""}`}
          data-direction={direction.toLowerCase()}
          style={{ transform: directionTransform }}
        >
          <div
            className="avatar-sprite"
            data-anim={track.id}
            data-state={state.toLowerCase()}
            aria-hidden="true"
          />
        </div>
      </div>
    </>
  );
}
