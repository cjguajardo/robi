// SVG icon set — consistent stroke-based line icons.
// All icons inherit color via currentColor so CSS controls the palette.
// viewBox: 24x24, stroke-width: 1.75, rounded caps — designed to scale cleanly.

interface IconProps {
  size?: number;
  className?: string;
  "aria-hidden"?: boolean;
}

function Icon({ children, size = 22, className }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/* ----- Input ---- */
export const MicIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <line x1="12" y1="18" x2="12" y2="21" />
    <line x1="8" y1="21" x2="16" y2="21" />
  </Icon>
);

export const MicStopIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" stroke="none" />
  </Icon>
);

export const MicBusyIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </Icon>
);

/* ----- Movement ---- */
export const ArrowUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 19V5" />
    <path d="M5 12l7-7 7 7" />
  </Icon>
);

export const ArrowDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14" />
    <path d="M5 12l7 7 7-7" />
  </Icon>
);

export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </Icon>
);

export const ArrowRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
    <path d="M12 5l7 7-7 7" />
  </Icon>
);

export const RotateLeftIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </Icon>
);

export const RotateRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v5h-5" />
  </Icon>
);

/* Jump — stick-figure mid-leap: torso tilted, knees tucked, motion
   arc above the head. Reads as "jumping" at 18px even when the cell
   holds an icon-only dpad button. */
export const JumpIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 18l4-4 3 3 4-4" />
    <path d="M9 14l3-7 3 7" />
    <path d="M7 5q1.5 -1.5 3 0" />
    <path d="M11 5q1.5 -1.5 3 0" />
  </Icon>
);

export const StopIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />
  </Icon>
);

/* ----- Actions ---- */
export const HandIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 11V6a1.5 1.5 0 0 1 3 0v4" />
    <path d="M10 11V4a1.5 1.5 0 0 1 3 0v7" />
    <path d="M13 11V5.5a1.5 1.5 0 0 1 3 0V12" />
    <path d="M16 11.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6v-1.5a1.5 1.5 0 0 1 3 0" />
  </Icon>
);

export const MusicIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" fill="currentColor" />
    <circle cx="18" cy="16" r="3" fill="currentColor" />
  </Icon>
);

export const StarIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l2.6 5.6 6.4.9-4.6 4.5 1.1 6.4L12 17.8l-5.5 2.6 1.1-6.4-4.6-4.5 6.4-.9z" />
  </Icon>
);

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 11l9-7 9 7" />
    <path d="M5 10v10h14V10" />
    <path d="M10 20v-6h4v6" />
  </Icon>
);

/* Joke — round smiling face with closed crescent eyes (^^) and a
   wide open grin. Reads as "laughter" at 20px next to text labels. */
export const JokeIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 10.5q-1.5 -2.5 -3 0" />
    <path d="M15 10.5q1.5 -2.5 3 0" />
    <path d="M8 14q4 5 8 0" />
  </Icon>
);

/* Riddle — speech bubble with a tail pointing down-left and a
   question mark inside. Distinguishes from JokeIcon (face) and
   FactIcon (bulb) at a glance. */
export const RiddleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 4h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-5l-4 3 1-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    <path d="M10.5 9.5a1.6 1.6 0 1 1 2 1.4c-.5.3-.8.8-.8 1.4" />
    <circle cx="11.7" cy="14.5" r="0.55" fill="currentColor" stroke="none" />
  </Icon>
);

/* Fact — classic incandescent bulb silhouette. Two horizontal lines
   at the base form the screw threads. Reads as "idea/knowledge" —
   the iconographic shorthand for "fun fact". */
export const FactIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3a6 6 0 0 0-4 10.5c.6.7 1 1.6 1 2.5h6c0-.9.4-1.8 1-2.5A6 6 0 0 0 12 3z" />
    <path d="M9.5 18h5" />
    <path d="M10.5 20.5h3" />
  </Icon>
);

/* ----- System ---- */
export const PauseIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="7" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="5" width="3" height="14" rx="1" fill="currentColor" stroke="none" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4v16l13-8z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" />
  </Icon>
);

export const SunIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1l2.1-2.1M17 7l2.1-2.1" />
  </Icon>
);

export const RefreshIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v5h-5" />
  </Icon>
);

/* ----- Status ---- */
export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 11l18-8-8 18-2-8z" />
  </Icon>
);

export const SparkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12l4 4 10-10" />
  </Icon>
);

export const AlertIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v6" />
    <circle cx="12" cy="16.5" r="0.5" fill="currentColor" />
  </Icon>
);