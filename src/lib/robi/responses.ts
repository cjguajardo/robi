// Friendly Spanish responses for ROBI.
//
// The phrasing lives in TWO places, joined by the audio catalog
// (`@/lib/robi/audio-catalog`):
//   - The TEXT shown in the speech bubble (= what we return from
//     `responseFor`).
//   - The AUDIO file played via the `audioUrl` field of the SAY event.
//
// Both come from `sonidos/audios.json` — that's the canonical source
// (it's what the OpenAI batch generator reads; see sonidos/README.md).
// We DON'T maintain a hand-written array of texts in this file: that
// would be a second source of truth, and the bubble would drift out of
// sync with the audio the moment someone regenerates with a different
// phrasing. Single source of truth = the audio catalog.
//
// What this file still owns:
//   - Mapping RobiCommandType → AudioCategory (one command often has
//     a category, but preambles are NOT auto-played — see scripts.md
//     §3.8/3.9/3.10).
//   - The `responseForWithAudio` helper that bundles { text, audioUrl }
//     for the WS server to broadcast.
//   - The legacy `responseFor(cmd) → string` kept around for callers
//     that don't need the audio (existing tests).
//   - Special-case handlers: STOP text that has no audio, plain-text
//     "Vuelvo al inicio." for RESET, etc. — these get the
//     no-audioUrl fallback path (TTS via /api/tts).
//
// See DESIGN.md §22, PRD §11.

import type { RobiCommand, RobiCommandType } from "@/types/robi";
import {
  pick,
  tryPick,
  entriesFor,
  type AudioEntry,
  type AudioCategory,
} from "@/lib/robi/audio-catalog";

/** Map a RobiCommandType to its audio category. `null` = no audio file;
 *  the caller falls back to /api/tts. */
function categoryFor(command: RobiCommandType): AudioCategory | null {
  switch (command) {
    case "WALK_LEFT":
      return "WALK_LEFT";
    case "WALK_RIGHT":
      return "WALK_RIGHT";
    case "JUMP":
      return "JUMP";
    case "STOP":
      return "STOP";
    case "GREET":
      return "GREET";
    case "DANCE":
      return "DANCE";
    case "CELEBRATE":
      return "CELEBRATE";
    case "TELL_JOKE":
      return "JOKE";
    case "TELL_RIDDLE":
      return "RIDDLE";
    case "TELL_FACT":
      return "FACT";
    case "SAY_GOODBYE":
      return "SAY_GOODBYE";
    case "UNKNOWN":
      return "UNKNOWN";
    case "RESET":
    case "ANSWER_QUESTION":
      // ANSWER_QUESTION is dynamic (LLM) — no pre-generated audio.
      // RESET uses a literal "Vuelvo al inicio." with no audio file.
      return null;
  }
}

/** Bundled {text, audioUrl?} payload for the WS SAY event. */
export interface RobiResponse {
  text: string;
  /** Pre-generated MP3 URL — undefined means "fall back to /api/tts". */
  audioUrl?: string;
}

/** Internal helper: take an entry from the catalog, optional crossfade. */
function fromEntry(entry: AudioEntry): RobiResponse {
  return { text: entry.text, audioUrl: entry.audioUrl };
}

/** Response for a successful command. */
export function responseForWithAudio(command: RobiCommand): RobiResponse {
  const cat = categoryFor(command.type);
  if (!cat) {
    return { text: dynamicFallback(command.type) };
  }
  return fromEntry(pick(cat));
}

/**
 * Legacy helper — returns just the text. Used by code paths that
 * don't need the audio (e.g. tests). Prefer `responseForWithAudio`.
 */
export function responseFor(command: RobiCommand): string {
  return responseForWithAudio(command).text;
}

/**
 * Literal fallbacks for commands without a pre-generated audio. These
 * hit the /api/tts endpoint, which has an LRU cache so repeat calls
 * (e.g. multiple RESETS in one session) don't re-hit OpenAI.
 */
function dynamicFallback(type: RobiCommandType): string {
  switch (type) {
    case "RESET":
      return "Vuelvo al inicio.";
    case "ANSWER_QUESTION":
      // ANSWER_QUESTION shouldn't go through this path — drainQueue
      // routes LLM answers directly. Throw to surface misuse.
      throw new Error(
        "responseFor() should not be called for ANSWER_QUESTION",
      );
    default:
      // Defensive — if we ever add a new RobiCommandType without
      // wiring its category, this throws instead of silent fallback.
      throw new Error(`No response wired for command "${type}"`);
  }
}

// --- Event-style helpers (PAUSE / RESUME / bug / complete) -------------
//
// These aren't tied to a RobiCommand in `responseFor`, but they trigger
// SAY broadcasts in the WS layer (ws.ts → server.ts → ingestSay). They
// each have an audio category that rotates independently.
//
// `bugResponse` / `completeResponse` aren't currently called from
// anywhere — kept exported for forward compatibility (the EVENT-driven
// paths would call them). When a caller lands here, the audio catalog
// is the right thing to consult too.

export function pausedResponseWithAudio(): RobiResponse {
  return fromEntry(pick("PAUSED"));
}
export function pausedResponse(): string {
  return pausedResponseWithAudio().text;
}

export function resumedResponseWithAudio(): RobiResponse {
  return fromEntry(pick("RESUMED"));
}
export function resumedResponse(): string {
  return resumedResponseWithAudio().text;
}

export function bugResponseWithAudio(): RobiResponse {
  return fromEntry(pick("BUG"));
}
export function bugResponse(): string {
  return bugResponseWithAudio().text;
}

export function completeResponseWithAudio(): RobiResponse {
  return fromEntry(pick("COMPLETE"));
}
export function completeResponse(): string {
  return completeResponseWithAudio().text;
}

/** Used by the TTS cache warmer. Now empty — pre-generated audios skip
 *  TTS entirely. Kept as an export so `server.mjs` doesn't break; the
 *  warmer is a no-op on an empty array. */
export const CACHEABLE_PHRASES: string[] = [];

export type ResponseKey = RobiCommandType | "UNKNOWN" | "PAUSED" | "RESUMED";

/**
 * Friendly fallback shown when the LLM is down / times out / returns
 * nothing. Picked from the `ANSWER_QUESTION_FALLBACK` audio category so
 * it has a pre-generated audio attached — no `/api/tts` roundtrip.
 * Rotates independently of every other category.
 */
export function questionFallbackResponse(): RobiResponse {
  return fromEntry(pick("ANSWER_QUESTION_FALLBACK"));
}

/**
 * Preamble played the INSTANT a kid asks a question, BEFORE the LLM
 * responds. Fills the silence while the kid waits for the answer.
 * Returns null if the catalog has no `ANSWER_QUESTION_PREAMBLE`
 * audios generated yet (degrades silently — the answer SAY still
 * broadcasts, just with no preamble lead-in).
 */
export function questionPreambleResponse(): RobiResponse | null {
  const entry = tryPick("ANSWER_QUESTION_PREAMBLE");
  return entry ? fromEntry(entry) : null;
}

/**
 * Preamble for the canned content commands (joke/riddle/fact).
 * Returns null if the catalog has no entries for that category
 * (same degradation contract as questionPreambleResponse).
 */
export function contentPreambleResponse(
  kind: "joke" | "riddle" | "fact",
): RobiResponse | null {
  const cat = preambleCategory(kind);
  const entry = tryPick(cat);
  return entry ? fromEntry(entry) : null;
}

/**
 * Map a content-command kind to its preamble audio category.
 * Exported so `preambleDurationMs` can use the same mapping.
 */
function preambleCategory(kind: "joke" | "riddle" | "fact"): AudioCategory {
  return kind === "joke"
    ? "TELL_JOKE_PREAMBLE"
    : kind === "riddle"
      ? "TELL_RIDDLE_PREAMBLE"
      : "TELL_FACT_PREAMBLE";
}

/**
 * Duration of the preamble audio for a content command, in
 * milliseconds. Reads `durationMs` from the catalog entry — populated
 * by `sonidos/durations.mjs` from `afinfo`.
 *
 * If the duration is missing in the JSON (backfill script hasn't run
 * yet), falls back to a conservative default (1500ms). The +100ms
 * buffer the server adds on top is documented in
 * `docs/references.md` §"Waiter pattern (preamble + content)".
 *
 * Returns 0 if the catalog has no entry for the requested category
 * (caller should treat that as "no preamble to wait for").
 */
export function preambleDurationMs(kind: "joke" | "riddle" | "fact"): number {
  const cat = preambleCategory(kind);
  const list = entriesFor(cat);
  if (list.length === 0) return 0;
  // The preamble was just picked (rotation rotates the counter), but
  // we want a stable "average preamble duration" here, not whatever the
  // next pick would be. Use the first available entry; durations are
  // roughly similar across entries in the same category (~10% variance
  // in our catalogs), so first-vs-average is a small error.
  const entry = list[0];
  return entry?.durationMs ?? 1500;
}

/** First question-fallback phrase as a plain string. Used by tests and
 *  by `answerQuestion` when it needs to return a single value. Kept
 *  for back-compat — prefer `questionFallbackResponse()`. */
export const QUESTION_FALLBACK: string =
  "Mmm, no se me ocurre qué decir. ¿Probamos otra pregunta?";
