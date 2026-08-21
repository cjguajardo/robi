// Core domain types for ROBI.
// Single source of truth for commands, states, and events.
// Mirrors DESIGN.md §7, §11, §13, §14.

/** Commands the robot understands — all possible intents. */
export type RobiCommand =
  // Lateral walking — pressed via dpad arrows or voice ("izquierda",
  // "camina a la derecha"). Combines a rotation with a translation so
  // ROBI ends up facing the direction it moved.
  | { type: "WALK_LEFT"; steps: number }
  | { type: "WALK_RIGHT"; steps: number }
  // Jump — always 1 block forward in the current direction. No steps
  // because a jump is a discrete, indivisible action for kids (kid-game
  // semantics: a jump button = one block, period).
  | { type: "JUMP" }
  | { type: "STOP" }
  | { type: "GREET" }
  | { type: "DANCE" }
  | { type: "CELEBRATE" }
  | { type: "RESET" }
  // Non-movement content actions — content lives in responses.ts.
  | { type: "TELL_JOKE" }
  | { type: "TELL_RIDDLE" }
  | { type: "TELL_FACT" }
  | { type: "SAY_GOODBYE" }
  // LLM-driven Q&A. The `question` is the kid's transcript (normalized),
  // sent to OpenAI on the server. The answer is broadcast as a SAY event.
  | { type: "ANSWER_QUESTION"; question: string }
  | { type: "UNKNOWN"; raw?: string };

export type RobiCommandType = RobiCommand["type"];

/** Cardinal direction ROBI faces on the projected scene. */
export type Direction = "NORTH" | "EAST" | "SOUTH" | "WEST";

/** Logical position on the scene (no physics — see DESIGN.md §24). */
export interface Position {
  x: number;
  y: number;
}

/** Minimal state set — see DESIGN.md §11. */
export type RobiState =
  | "SLEEPING"
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "SPEAKING"
  | "EXECUTING"
  | "CONFUSED"
  | "CELEBRATING"
  | "PAUSED";

/** Reducer events — see DESIGN.md §13. */
export type RobiEvent =
  | { type: "WAKE" }
  | { type: "LISTEN" }
  | { type: "THINK" }
  | { type: "SPEAK" }
  | { type: "EXECUTE"; command: RobiCommand }
  | { type: "APPLY_MOVEMENT" }
  | { type: "RETURN_TO_EXECUTION" }
  | { type: "ERROR" }
  | { type: "COMPLETE" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "RESET" };

/**
 * Payload of a `SAY` event — what ROBI says, optionally with a
 * pre-recorded audio URL. When `audioUrl` is present the /display
 * plays the static MP3 (zero TTS API calls). When absent the
 * /display falls back to `/api/tts`. LLM-generated answers carry
 * no `audioUrl`; canned responses carry one whenever a matching
 * audios.json entry exists.
 */
export interface SayPayload {
  text: string;
  audioUrl?: string;
}

/** Realtime wire format — see DESIGN.md §14. */
export type RealtimeEvent =
  | { type: "COMMAND"; payload: RobiCommand }
  | { type: "STATE_CHANGED"; payload: RobiState }
  // World sync — broadcast after each EXECUTE so the /display can
  // render the new (position, direction). STATE_CHANGED only carries
  // the RobiState, so without this event the avatar would only ever
  // know about its starting coordinates (from the initial SNAPSHOT).
  | { type: "WORLD_CHANGED"; payload: { position: Position; direction: Direction } }
  | { type: "SPEECH_STARTED" }
  | { type: "SPEECH_ENDED" }
  | { type: "TRANSCRIPT"; payload: string }
  | { type: "SAY"; payload: SayPayload }
  | { type: "RESET" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "SNAPSHOT"; payload: SessionSnapshot };

/** Full session snapshot — broadcast on reconnect. */
export interface SessionSnapshot {
  state: RobiState;
  position: Position;
  direction: Direction;
  lastTranscript: string;
  lastCommand: RobiCommand | null;
  paused: boolean;
}

/** Configuration knobs — see DESIGN.md §32. */
export interface RobiConfig {
  maxSteps: number;
  defaultSteps: number;
  llmFallbackEnabled: boolean;
}
