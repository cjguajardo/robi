// Speech bubble — short, kid-friendly on-screen text.
// Hidden by default; appears briefly after ROBI says something.

import type { RobiState } from "@/types/robi";

interface Props {
  text: string | null;
  state: RobiState;
}

export function RobiSpeechBubble({ text, state }: Props) {
  if (!text) return null;
  return (
    <div className={`speech speech-${state.toLowerCase()}`} role="status" aria-live="polite">
      <span>{text}</span>
    </div>
  );
}
