// Mini ROBI face — compact status avatar for /control.
// Now uses the /control-sprites.webp sheet (10 face cells, 1 per state)
// instead of inline SVG. The face itself encodes the state — no
// separate ring color or antenna needed.
import type { RobiState } from "@/types/robi";
import { faceBadgeStyle, faceBackgroundPosition } from "./control-sprites";

interface Props {
  state: RobiState;
  /** Width of the rendered cell in pixels. Height auto-derives from the 130:110 aspect ratio. */
  size?: number;
}

export function RobiStateBadge({ state, size = 132 }: Props) {
  const isPaused = state === "PAUSED";

  // Split: the static sprite styling (image, size) is in one object,
  // the dynamic background-position (per-state cell) in another. Keeping
  // them separate makes the inline style readable.
  const spriteStyle: React.CSSProperties = {
    ...faceBadgeStyle(size),
    ...faceBackgroundPosition(state, size),
  };

  return (
    <div className="badge-frame">
      <div
        className={`badge badge-${state.toLowerCase()}`}
        style={spriteStyle}
        role="img"
        aria-hidden="true"
      />
      {isPaused && (
        <div className="badge-paused-overlay" aria-hidden="true">
          <span className="bar" />
          <span className="bar" />
        </div>
      )}
    </div>
  );
}