// ROBI face — eyes + mouth. Pure CSS, animated by data-state.

import type { RobiState } from "@/types/robi";

interface Props {
  state: RobiState;
}

export function RobiFace({ state }: Props) {
  const isSleeping = state === "SLEEPING";
  const isConfused = state === "CONFUSED";
  const isCelebrating = state === "CELEBRATING";
  const isSpeaking = state === "SPEAKING";
  const isListening = state === "LISTENING";

  return (
    <svg
      viewBox="0 0 200 200"
      className={`face face-${state.toLowerCase()}`}
      aria-hidden="true"
    >
      {/* Head circle */}
      <circle cx="100" cy="100" r="92" fill="#1d2647" stroke="#6ee7ff" strokeWidth="4" />
      {/* Antenna */}
      <line x1="100" y1="14" x2="100" y2="-4" stroke="#6ee7ff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="100" cy="-4" r="6" fill={isListening ? "#6bff9a" : "#6ee7ff"} className="antenna-tip" />

      {/* Eyes */}
      <g className="eyes">
        <ellipse
          cx="68"
          cy="92"
          rx={isSleeping ? 14 : 10}
          ry={isSleeping ? 2 : 12}
          fill="#f6f7fb"
          className="eye eye-left"
        />
        <ellipse
          cx="132"
          cy="92"
          rx={isSleeping ? 14 : 10}
          ry={isSleeping ? 2 : 12}
          fill="#f6f7fb"
          className="eye eye-right"
        />
        {!isSleeping && (
          <>
            <circle cx="68" cy="94" r="4" fill="#0b1020" className="pupil" />
            <circle cx="132" cy="94" r="4" fill="#0b1020" className="pupil" />
          </>
        )}
      </g>

      {/* Mouth — morphs by state */}
      {isSleeping && <path d="M82 138 Q100 144 118 138" stroke="#f6f7fb" strokeWidth="4" fill="none" strokeLinecap="round" />}
      {isConfused && <path d="M80 142 Q100 124 120 142" stroke="#f6f7fb" strokeWidth="4" fill="none" strokeLinecap="round" />}
      {isCelebrating && <path d="M72 130 Q100 156 128 130" stroke="#f6f7fb" strokeWidth="4" fill="none" strokeLinecap="round" />}
      {isSpeaking && (
        <ellipse cx="100" cy="140" rx="18" ry="10" fill="#0b1020" className="mouth-speaking" />
      )}
      {!isSleeping && !isConfused && !isCelebrating && !isSpeaking && (
        <path d="M84 138 L116 138" stroke="#f6f7fb" strokeWidth="4" strokeLinecap="round" />
      )}

      {/* Cheek lights when listening */}
      {isListening && (
        <>
          <circle cx="40" cy="120" r="6" fill="#6bff9a" className="cheek" />
          <circle cx="160" cy="120" r="6" fill="#6bff9a" className="cheek" />
        </>
      )}
    </svg>
  );
}
