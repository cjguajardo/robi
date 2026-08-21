// Status pill — small dev-facing chip. Off by default per PRD §5.1
// (no technical details visible to kids). The /display page opts in.

import type { RobiState } from "@/types/robi";

interface Props {
  state: RobiState;
  position: { x: number; y: number };
  direction: "NORTH" | "EAST" | "SOUTH" | "WEST";
  paused: boolean;
}

const LABELS: Record<RobiState, string> = {
  SLEEPING: "Dormido",
  IDLE: "En espera",
  LISTENING: "Escuchando",
  THINKING: "Pensando",
  SPEAKING: "Hablando",
  EXECUTING: "Ejecutando",
  CONFUSED: "Confundido",
  CELEBRATING: "Celebrando",
  PAUSED: "En pausa",
};

export function RobiStatus({ state, position, direction, paused }: Props) {
  return (
    <div className="status" aria-hidden="true">
      <span className="dot" data-state={state} />
      <span className="label">{paused ? "Pausado" : LABELS[state]}</span>
      <span className="meta">
        ({position.x},{position.y}) · {direction}
      </span>
    </div>
  );
}
