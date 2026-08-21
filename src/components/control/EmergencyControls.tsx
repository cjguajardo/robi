// Emergency + lifecycle controls — sticky bottom bar.
// SVG icons, ripple on press, prominent visual hierarchy.

import { PauseIcon, PlayIcon, RefreshIcon } from "./Icons";

interface Props {
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  paused: boolean;
}

function spawnRipple(e: React.MouseEvent<HTMLButtonElement>) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement("span");
  const size = Math.max(rect.width, rect.height) * 1.4;
  ripple.className = "ripple ripple-strong";
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
}

export function EmergencyControls({ onPause, onResume, onReset, paused }: Props) {
  return (
    <div className="emergency-bar" role="toolbar" aria-label="Controles de emergencia">
      {paused ? (
        <button
          type="button"
          className="ebtn resume"
          onClick={(e) => {
            spawnRipple(e);
            onResume();
          }}
        >
          <PlayIcon size={18} />
          <span className="lb">Reanudar</span>
        </button>
      ) : (
        <button
          type="button"
          className="ebtn stop"
          onClick={(e) => {
            spawnRipple(e);
            onPause();
          }}
        >
          <PauseIcon size={18} />
          <span className="lb">Detener</span>
        </button>
      )}
      <button
        type="button"
        className="ebtn reset"
        onClick={(e) => {
          spawnRipple(e);
          onReset();
        }}
      >
        <RefreshIcon size={18} />
        <span className="lb">Reiniciar</span>
      </button>
    </div>
  );
}