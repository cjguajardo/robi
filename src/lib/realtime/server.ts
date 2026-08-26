// ROBI's world — server-side state for the single in-process session.
// One control peer + one display peer share this. See DESIGN.md §14, §26.

import type {
  Position,
  PresentationState,
  RealtimeEvent,
  RobiCommand,
  RobiState,
  SessionSnapshot,
  StageItem,
  StageItemPlacement,
} from "@/types/robi";
import { PRESENTATION_SLIDES } from "@/lib/presentation/slides";
import { initialWorld, reduceWorld, type RobiWorld } from "@/lib/robi/reducer";
import { validateCommand } from "@/lib/robi/validator";
import { SERVER_CONFIG } from "@/lib/robi/config.server";
import {
  contentPreambleResponse,
  preambleDurationMs,
  questionPreambleResponse,
  responseForWithAudio,
} from "@/lib/robi/responses";
import { answerQuestion } from "@/lib/llm/answer-question";
import { synthesizeSpeech } from "@/lib/tts/synthesize";
import { MS_PER_BLOCK } from "@/lib/robi/commands";
import {
  collisionProgress,
  createRandomStageItem,
} from "@/lib/robi/stage-items";

interface Peer {
  send: (event: RealtimeEvent) => void;
}

interface World {
  world: RobiWorld;
  lastTranscript: string;
  lastCommand: RobiCommand | null;
  peers: Set<Peer>;
  queue: RobiCommand[];
  processing: boolean;
  /**
   * Resolver for the SAY that drainQueue is currently waiting on. Set
   * immediately before broadcasting the SAY (interleaved SAYs in the
   * same command — preamble of joke/riddle/fact, answer of QUESTION —
   * overwrite it without resolving). Cleared after firing.
   */
  pendingAudioResolver: (() => void) | null;
  /** Timer handle for the safety timeout on `pendingAudioResolver`. */
  pendingAudioTimer: ReturnType<typeof setTimeout> | null;
  /** Invalidates async command work that was still awaiting I/O during RESET. */
  commandGeneration: number;
  stageItem: StageItem | null;
  presentationSlide: number;
}

const state: World = {
  world: { ...initialWorld },
  lastTranscript: "",
  lastCommand: null,
  peers: new Set(),
  queue: [],
  processing: false,
  pendingAudioResolver: null,
  pendingAudioTimer: null,
  commandGeneration: 0,
  stageItem: null,
  presentationSlide: 1,
};

interface ScheduledStageCollision {
  timer: ReturnType<typeof setTimeout>;
  cancel: () => void;
}

const scheduledStageCollisions = new Set<ScheduledStageCollision>();

function snapshot(): SessionSnapshot {
  return {
    state: state.world.state,
    position: state.world.position,
    direction: state.world.direction,
    lastTranscript: state.lastTranscript,
    lastCommand: state.lastCommand,
    paused: state.world.paused,
    stageItem: state.stageItem,
    presentation: presentationState(),
  };
}

function presentationState(): PresentationState {
  return {
    currentSlide: state.presentationSlide,
    totalSlides: PRESENTATION_SLIDES.length,
  };
}

function broadcast(event: RealtimeEvent): void {
  for (const peer of state.peers) {
    try {
      peer.send(event);
    } catch {
      // Peer will be cleaned up on close; ignore write errors.
    }
  }
}

function transition(event: Parameters<typeof reduceWorld>[1]): RobiWorld {
  const before = state.world.state;
  state.world = reduceWorld(state.world, event);
  if (state.world.state !== before) {
    broadcast({ type: "STATE_CHANGED", payload: state.world.state });
  }
  return state.world;
}

/** Attach a peer. Sends a SNAPSHOT so the new peer syncs. */
export function attachPeer(peer: Peer): SessionSnapshot {
  state.peers.add(peer);
  const snap = snapshot();
  try {
    peer.send({ type: "SNAPSHOT", payload: snap });
  } catch {
    // ignore
  }
  return snap;
}

export function detachPeer(peer: Peer): void {
  state.peers.delete(peer);
}

/** Inbound command from a peer. Validates, queues, broadcasts. */
export function ingestCommand(
  command: unknown,
  transcript?: string
): RobiCommand {
  if (typeof transcript === "string") {
    state.lastTranscript = transcript;
    broadcast({ type: "TRANSCRIPT", payload: transcript });
  }

  // Reject if paused (DESIGN.md §28).
  if (state.world.paused) {
    broadcast({ type: "STATE_CHANGED", payload: state.world.state });
    return { type: "STOP" };
  }

  // Reject if a command is mid-flight (DESIGN.md §26 — simple rejection policy).
  if (state.processing) {
    return { type: "STOP" };
  }

  const result = validateCommand(command, SERVER_CONFIG);
  if (!result.ok) {
    state.lastCommand = { type: "UNKNOWN", raw: String(command) };
    broadcast({ type: "STATE_CHANGED", payload: "CONFUSED" });
    return state.lastCommand;
  }

  state.lastCommand = result.command;
  state.queue.push(result.command);
  drainQueue().catch((err) => console.error("[drainQueue]", err));
  return result.command;
}

async function drainQueue(): Promise<void> {
  if (state.processing) return;
  const next = state.queue.shift();
  if (!next) return;

  state.processing = true;
  const commandGeneration = state.commandGeneration;
  const wasReset = () => commandGeneration !== state.commandGeneration;
  // Broadcast the COMMAND BEFORE the state transition so clients receive
  // the command context (which command triggered EXECUTING?) before the
  // STATE_CHANGED event that depends on it. Sprite/display logic uses
  // this to pick the right animation track.
  broadcast({ type: "COMMAND", payload: next });
  transition({ type: "EXECUTE", command: next });
  // Broadcast the new (position, direction) so the /display can render
  // the world move. STATE_CHANGED only carries the RobiState, so without
  // this event the avatar would only ever know about its starting
  // coordinates (received on the initial SNAPSHOT). Sent AFTER the
  // reducer runs so the payload reflects the post-EXECUTE world.
  broadcast({
    type: "WORLD_CHANGED",
    payload: {
      position: state.world.position,
      direction: state.world.direction,
    },
  });

  // Walking begins in the same command turn as its SAY. EXECUTE first
  // broadcasts the new direction with the current position, then this
  // APPLY_MOVEMENT broadcasts the destination immediately. The display
  // receives COMMAND/EXECUTING before the destination, so its walk sprite
  // and world transition start together with "¡A la izquierda/derecha!"
  // instead of waiting for SPEECH_ENDED.
  const visualDelayMs = actionAnimationMs(next);
  let walkVisualCompletion: Promise<void> | null = null;
  if (
    (next.type === "WALK_LEFT" || next.type === "WALK_RIGHT") &&
    state.world.pendingMove
  ) {
    const from = state.world.position;
    const target = state.stageItem;
    transition({ type: "APPLY_MOVEMENT" });

    const visualTasks: Promise<unknown>[] = [sleep(visualDelayMs)];
    if (target) {
      const progress = collisionProgress(
        target,
        from,
        state.world.position,
        next,
      );
      if (progress !== null) {
        visualTasks.push(
          removeStageItemAfter(target, visualDelayMs * progress),
        );
      }
    }

    broadcast({
      type: "WORLD_CHANGED",
      payload: {
        position: state.world.position,
        direction: state.world.direction,
      },
    });
    walkVisualCompletion = Promise.all(visualTasks).then(() => undefined);
  }

  // JUMP has no world translation: its contact point is the CSS
  // animation apex, halfway through the 700ms hop that starts as soon
  // as COMMAND reaches /display. Schedule this independently from the
  // speech lifecycle so the object disappears when ROBI visually
  // touches it, not later when the audio ends.
  const jumpTarget = state.stageItem;
  if (jumpTarget && next.type === "JUMP") {
    const progress = collisionProgress(
      jumpTarget,
      state.world.position,
      state.world.position,
      next,
    );
    if (progress !== null) {
      void removeStageItemAfter(
        jumpTarget,
        actionAnimationMs(next) * progress,
      );
    }
  }

  // The drainQueue now waits for the LAST audio of each command to
  // actually finish playing (driven by SPEECH_ENDED from the client),
  // not for a fixed estimate. Interim SAYs (preamble of joke/riddle/
  // fact; preamble of QUESTION) are broadcast freely without a waiter
  // — the resolver for the final SAY overwrites any earlier one.
  if (next.type === "ANSWER_QUESTION") {
    // Pipeline (in order of "what fires when"):
    //   T=0   fork: broadcast SAY(preamble)  +  start LLM.call(question)
    //   T=L   LLM returns the answer text
    //   T=L+T synthesizeSpeech(text) returns the mp3 buffer
    //   T=L+T+T+ε  broadcast SAY({text, audioUrl: data:…mp3})
    //   T=L+T+T+X  client audio ends → SPEECH_ENDED → drainQueue resumes.
    //
    // The fork at T=0 is the only place we overlap work — everything
    // after the LLM resolves is strictly sequential because we need the
    // text to synthesize and the audio to broadcast. The kid hears the
    // pre-recorded preamble while the model thinks; by the time it
    // returns, the answer text + audio are both ready, so the second
    // SAY plays instantly via `audio.src = audioUrl` (no client
    // roundtrip to /api/tts).
    //
    // Graceful: if the catalog has no ANSWER_QUESTION_PREAMBLE audios
    // yet, the preamble step is skipped and only the answer plays.
    // Graceful: if the catalog returns a fallback (no API key, LLM
    // failure, etc.) `answer.audioUrl` is already populated from the
    // catalog and we skip synthesizeSpeech entirely — no double work.
    const apiKey = process.env.OPENAI_API_KEY;
    const llmPromise = answerQuestion(next.question, apiKey);

    const preamble = questionPreambleResponse();
    if (preamble) {
      broadcast({ type: "SAY", payload: preamble });
    }

    const answer = await llmPromise;
    if (wasReset()) return;
    const answerWithAudio: { text: string; audioUrl?: string; durationMs?: number } =
      answer.audioUrl
        ? answer
        : await synthesizeAnswerAudio(answer.text).then(
            (audioUrl) => ({ text: answer.text, audioUrl }),
            (err) => {
              console.error(
                "[drainQueue] TTS failed for ANSWER_QUESTION; " +
                  "client will fall back to /api/tts",
                err,
              );
              // Leave `audioUrl` undefined — the client's existing
              // /api/tts fallback path still produces audio. Better
              // than silence.
              return answer;
            },
          );
    if (wasReset()) return;

    // Set up the waiter BEFORE broadcasting so a fast-fire SPEECH_ENDED
    // (very short answer audio, pre-cached player) still has someone
    // to resolve. The waiter covers whichever audio actually plays
    // (pre-recorded or freshly synthesized).
    //
    // ANSWER_QUESTION answers can be either catalog (fallback audio with
    // known durationMs) or freshly synthesized (no known duration —
    // synthesized server-side via TTS, base64 data URL). We size the
    // safety timer off the catalog duration when known, and fall back
    // to the 8s default ceiling otherwise. The freshly-synthesized
    // path usually finishes inside that ceiling; the catalog path is
    // 3-4s — well within.
    const waiter = waitForSpeechEnded(answerWithAudio.durationMs);
    broadcast({ type: "SAY", payload: answerWithAudio });
    await waiter;
    if (wasReset()) return;
  } else if (
    next.type === "TELL_JOKE" ||
    next.type === "TELL_RIDDLE" ||
    next.type === "TELL_FACT"
  ) {
    // For the canned content commands: play a brief preamble first,
    // then the actual joke/riddle/fact. The preamble sets expectation
    // ("Want to hear a joke?"). The gap between preamble and content
    // is the preamble audio duration + 100ms buffer — the buffer
    // covers the WebSocket round-trip + client audio-end event so the
    // client's `stopAudio()` doesn't cut the preamble mid-sentence
    // (which it would if we waited exactly the audio length).
    //
    // If no preamble audios exist yet for that category, we skip the
    // preamble and just play the content alone — the user can run
    // `pnpm audios` later. If the backfill script (`pnpm audios:durations`)
    // hasn't been run yet, `preambleDurationMs()` falls back to a
    // conservative 1500ms default; the audio will play to the end of
    // the catalog entry but the content SAY may broadcast slightly
    // before/after the audio actually stops.
    const kind =
      next.type === "TELL_JOKE"
        ? "joke"
        : next.type === "TELL_RIDDLE"
          ? "riddle"
          : "fact";
    const preamble = contentPreambleResponse(kind);
    if (preamble) {
      broadcast({ type: "SAY", payload: preamble });
      const preambleMs = preambleDurationMs(kind);
      await sleep(preambleMs + CONTENT_BUFFER_MS);
      if (wasReset()) return;
    }
    // Size the waiter off the picked content's actual duration. Several
    // catalog audios are 8-13s (fact-01 is 13.2s — see audios.json) and
    // exceed the default 8s ceiling; without this, the safety timer
    // fires mid-playback and the next command cuts the audio off.
    const phrase = responseForWithAudio(next);
    const waiter = waitForSpeechEnded(phrase.durationMs);
    broadcast({ type: "SAY", payload: phrase });
    await waiter;
    if (wasReset()) return;
  } else {
    const phrase = responseForWithAudio(next);
    const waiter = waitForSpeechEnded(phrase.durationMs);
    broadcast({ type: "SAY", payload: phrase });
    await waiter;
    if (wasReset()) return;
  }

  // Walking visual time started before the SAY and therefore overlaps
  // audio playback. If speech is shorter, wait only for the remaining
  // movement; if speech is longer, the visual promise is already done.
  // Other action tracks keep their existing post-audio hold behavior.
  if (walkVisualCompletion) {
    await walkVisualCompletion;
    if (wasReset()) return;
  } else if (visualDelayMs > 0) {
    await sleep(visualDelayMs);
    if (wasReset()) return;
  }
  state.processing = false;
  transition({ type: "COMPLETE" });

  if (state.queue.length > 0) {
    drainQueue().catch((err) => console.error("[drainQueue]", err));
  }
}

/**
 * Visible action-animation duration. Tracked separately from audio
 * playback so that walking / jumping / dancing stays on screen long
 * enough for the kid to actually SEE the body motion — not just hear
 * the audio cue.
 *
 * Tuned per command:
 *   - Walking: scales with `steps` so 3-step walks animate over ~1s.
 *   - Jump:    ~700ms (a hop up-and-back-down).
 *   - Dance:   2s of looping dance before COMPLETE.
 *   - Celebrate: 1.5s of celebrating.
 *   - Greet / Goodbye: 1s of waving.
 *   - Content commands (joke/riddle/fact/answer/reset/pause):
 *     0ms — no extra visible motion after the audio finishes.
 */
function actionAnimationMs(cmd: RobiCommand): number {
  switch (cmd.type) {
    case "WALK_LEFT":
    case "WALK_RIGHT":
      return Math.max(400, cmd.steps * MS_PER_BLOCK);
    case "JUMP":
      return 700;
    case "DANCE":
      return 2000;
    case "CELEBRATE":
      return 1500;
    case "GREET":
    case "SAY_GOODBYE":
      return 1000;
    default:
      return 0;
  }
}

/**
 * Commands whose visible sprite is an action (motion) rather than a
 * thinking posture. Used by `ingestSpeechEvent` to decide whether
 * SPEECH_ENDED should fall back to the action sprite (RETURN_TO_
 * EXECUTION) or to the thinking posture (THINK).
 */
function isActionCommand(cmd: RobiCommand): boolean {
  switch (cmd.type) {
    case "WALK_LEFT":
    case "WALK_RIGHT":
    case "JUMP":
    case "DANCE":
    case "CELEBRATE":
    case "GREET":
    case "SAY_GOODBYE":
      return true;
    default:
      return false;
  }
}

/**
 * Commands whose audio is a movement cue rather than spoken dialogue.
 * Their audio lifecycle still unblocks the command queue, but it must
 * never replace the visible movement track with the speaking sprite.
 */
function isMovementCommand(cmd: RobiCommand): boolean {
  return (
    cmd.type === "WALK_LEFT" ||
    cmd.type === "WALK_RIGHT" ||
    cmd.type === "JUMP"
  );
}

/** Apply a non-command world event (pause, resume, reset). */
export function ingestWorldEvent(
  event: "PAUSE" | "RESUME" | "RESET"
): void {
  switch (event) {
    case "PAUSE":
      cancelScheduledStageCollisions();
      state.queue = [];
      state.processing = false;
      transition({ type: "PAUSE" });
      break;
    case "RESUME":
      transition({ type: "RESUME" });
      break;
    case "RESET":
      cancelScheduledStageCollisions();
      state.commandGeneration += 1;
      state.queue = [];
      state.processing = false;
      if (state.pendingAudioTimer) clearTimeout(state.pendingAudioTimer);
      state.pendingAudioTimer = null;
      const pendingAudioResolver = state.pendingAudioResolver;
      state.pendingAudioResolver = null;
      pendingAudioResolver?.();
      state.world = { ...initialWorld };
      state.lastTranscript = "";
      state.lastCommand = null;
      state.stageItem = null;
      broadcast({ type: "RESET" });
      broadcast({ type: "STAGE_ITEM_CHANGED", payload: null });
      broadcast({ type: "STATE_CHANGED", payload: "SLEEPING" });
      break;
  }
}

/**
 * Place one random target relative to ROBI. The server owns randomness
 * so /control and /display cannot diverge when multiple peers connect.
 */
export function ingestStageItemRequest(
  placement: unknown,
  random: () => number = Math.random,
): StageItem | null {
  if (placement !== "ABOVE" && placement !== "LEFT" && placement !== "RIGHT") {
    return null;
  }

  const item = createRandomStageItem(
    placement as StageItemPlacement,
    state.world.position,
    random,
  );
  state.stageItem = item;
  broadcast({ type: "STAGE_ITEM_CHANGED", payload: item });
  return item;
}

/** Move the shared presentation to one validated, one-based slide. */
export function ingestPresentationGoto(slide: unknown): PresentationState {
  if (
    !Number.isInteger(slide) ||
    typeof slide !== "number" ||
    slide < 1 ||
    slide > PRESENTATION_SLIDES.length ||
    slide === state.presentationSlide
  ) {
    return presentationState();
  }

  state.presentationSlide = slide;
  const next = presentationState();
  broadcast({ type: "PRESENTATION_CHANGED", payload: next });
  return next;
}

/** Request ROBI to say something — used after parse / command.
 *  Accepts either a string (no audio — falls back to /api/tts) or a
 *  pre-built SayPayload (text + optional audioUrl). */
export function ingestSay(payload: { text: string; audioUrl?: string } | string): void {
  const sayPayload = typeof payload === "string" ? { text: payload } : payload;
  broadcast({ type: "SAY", payload: sayPayload });
}

/** Read current world state without mutating. */
export function readSnapshot(): SessionSnapshot {
  return snapshot();
}

/** Reset world + clear peers. Test-only helper. */
export function _resetForTesting(): void {
  cancelScheduledStageCollisions();
  state.commandGeneration += 1;
  state.world = { ...initialWorld };
  state.lastTranscript = "";
  state.lastCommand = null;
  state.peers.clear();
  state.queue = [];
  state.processing = false;
  if (state.pendingAudioTimer) {
    clearTimeout(state.pendingAudioTimer);
  }
  state.pendingAudioTimer = null;
  state.pendingAudioResolver = null;
  state.stageItem = null;
  state.presentationSlide = 1;
}

function removeStageItemAfter(item: StageItem, delayMs: number): Promise<boolean> {
  if (delayMs <= 0) return Promise.resolve(removeStageItemIfCurrent(item));

  return new Promise((resolve) => {
    let settled = false;
    const finish = (removed: boolean) => {
      if (settled) return;
      settled = true;
      scheduledStageCollisions.delete(scheduled);
      resolve(removed);
    };
    const timer = setTimeout(() => {
      finish(removeStageItemIfCurrent(item));
    }, delayMs);
    const scheduled: ScheduledStageCollision = {
      timer,
      cancel: () => {
        clearTimeout(timer);
        finish(false);
      },
    };
    scheduledStageCollisions.add(scheduled);
  });
}

function removeStageItemIfCurrent(item: StageItem): boolean {
  if (state.stageItem !== item) return false;
  state.stageItem = null;
  broadcast({ type: "STAGE_ITEM_CHANGED", payload: null });
  return true;
}

function cancelScheduledStageCollisions(): void {
  for (const scheduled of [...scheduledStageCollisions]) {
    scheduled.cancel();
  }
}

/**
 * Override the safety timeout for `waitForSpeechEnded`. Tests use a
 * tiny value (e.g. 100ms) so they don't wait the production 8 seconds.
 * Pass `null` to restore the default.
 */
export function _setAudioTimeoutForTesting(ms: number | null): void {
  MAX_AUDIO_DURATION_MS = ms ?? 8000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pre-synthesize TTS audio for an LLM-generated answer and return it
 * as a `data:audio/mpeg;base64,…` URL the client can play directly via
 * `<audio>.src = audioUrl`. Used by ANSWER_QUESTION so the second SAY
 * arrives with audio bundled — no `/api/tts` roundtrip from the client.
 *
 * Typical mp3 size: 30-80 KB at OpenAI's default bitrate; ~100-200 KB
 * after base64. Acceptable for a single WS message; we only do this
 * once per question.
 *
 * Throws on TTS failure — caller catches and falls back to text-only
 * (client's `/api/tts` fallback then runs). Never returns undefined.
 */
async function synthesizeAnswerAudio(text: string): Promise<string> {
  const audio = await synthesizeSpeech(text);
  return `data:audio/mpeg;base64,${audio.toString("base64")}`;
}

/**
 * Safety timeout for `waitForSpeechEnded` when no audio duration is
 * known. If the client never sends SPEECH_ENDED (display disconnected,
 * browser tab killed, audio decoding failed without firing `error`),
 * the server must NOT hang forever — kids would press buttons and
 * nothing would happen.
 *
 * Sized for the dynamic-TTS fallback path (e.g. RESET's "Vuelvo al
 * inicio."): the LLM/TTS response is typically 2-5s, so 8s is a
 * generous ceiling. Pre-generated catalog audios carry their actual
 * `durationMs` and `waitForSpeechEnded` sizes its safety timer off
 * that instead — see AUDIO_SAFETY_BUFFER_MS below.
 *
 * Mutable via `_setAudioTimeoutForTesting` so unit tests don't wait
 * the full 8s between commands.
 */
let MAX_AUDIO_DURATION_MS = 8000;

/**
 * Buffer added on top of an audio's known `durationMs` when sizing
 * the per-audio safety timer. Covers WS roundtrip + browser audio
 * decode tail + a little slack for slower displays. 2000ms is
 * empirically generous: the WS roundtrip + `audio.ended` is well
 * under 100ms on localhost; over a typical LAN it's still <500ms.
 * Bump to 3000-4000 only if you ever observe the safety timer firing
 * for an audio whose durationMs is set.
 */
const AUDIO_SAFETY_BUFFER_MS = 2000;

/**
 * Wait until the client reports that the most recent SAY's audio has
 * finished playing. Falls back to a safety timeout so the queue can
 * always make progress.
 *
 * `expectedDurationMs`, when provided, sizes the safety timer to
 * `expectedDurationMs + AUDIO_SAFETY_BUFFER_MS`. This matters for
 * the pre-generated content audios, several of which exceed the
 * default 8s ceiling (fact-01 is 13.2s, riddle-03 is 9.4s, etc. —
 * see `sonidos/audios.json`). Without this, the safety timer fires
 * mid-playback, the drainQueue proceeds, and the kid hears the next
 * command's SAY cut the previous audio off mid-sentence.
 *
 * Pass `undefined` (or rely on the default) for the dynamic-TTS
 * fallback path (no known duration); the `MAX_AUDIO_DURATION_MS`
 * ceiling applies there.
 *
 * The resolver is set BEFORE broadcasting the SAY so a SPEECH_ENDED
 * that races ahead of broadcast (very short audio, cached player)
 * still has someone to resolve. Calling `waitForSpeechEnded` again
 * overwrites the previous waiter — designed for the preamble-then-
 * content / preamble-then-answer interleaved SAY pattern.
 */
/**
 * Test-only: compute the safety-timer duration for a given audio.
 * Exposes the formula inside `waitForSpeechEnded` so tests can lock
 * in the sizing without waiting for actual timers to fire. The
 * production-side caller is `waitForSpeechEnded` — keep these in
 * sync if the formula changes.
 */
export function _safetyTimerDurationMs(
  expectedDurationMs: number | undefined,
): number {
  return expectedDurationMs !== undefined
    ? expectedDurationMs + AUDIO_SAFETY_BUFFER_MS
    : MAX_AUDIO_DURATION_MS;
}

function waitForSpeechEnded(expectedDurationMs?: number): Promise<void> {
  const safetyMs = _safetyTimerDurationMs(expectedDurationMs);
  return new Promise((resolve) => {
    const safety = setTimeout(() => {
      console.warn("[server] audio playback timed out (no SPEECH_ENDED); proceeding");
      cleanup();
      resolve();
    }, safetyMs);

    function cleanup(): void {
      if (state.pendingAudioTimer === safety) {
        state.pendingAudioTimer = null;
      }
      state.pendingAudioResolver = null;
    }

    state.pendingAudioTimer = safety;
    state.pendingAudioResolver = () => {
      clearTimeout(safety);
      cleanup();
      resolve();
    };
  });
}

/**
 * Called when the display reports an audio lifecycle event. Drives the
 * SPRITE state (SPEAKING ↔ action-specific) and unblocks drainQueue's
 * `waitForSpeechEnded` so the command can COMPLETE.
 *
 * Two types of behavior on SPEECH_ENDED:
 *   - ACTION command (WALK / JUMP / DANCE / CELEBRATE / GREET /
 *     SAY_GOODBYE): revert to EXECUTING so the command-aware sprite
 *     (walking / dancing / waving / etc.) plays out visibly until
 *     its visual track and audio lifecycle are both complete. WALK
 *     overlaps those tracks; the other actions retain a post-audio hold.
 *   - CONTENT command (TELL_JOKE / TELL_RIDDLE / TELL_FACT /
 *     ANSWER_QUESTION / UNKNOWN): go straight to COMPLETE → IDLE.
 *     Earlier revisions bounced through THINKING here, but the
 *     intermediate broadcast left the avatar on the 4-frame thinking
 *     loop long enough to be visible — especially during the
 *     preamble→content gap of TELL_FACT and similar commands, where
 *     the gap is `preambleDurationMs + CONTENT_BUFFER_MS` and the
 *     thinking sprite clearly cycles. Skipping the THINK transition
 *     keeps the kid's perception "ROBI is done talking, at rest."
 */
export function ingestSpeechEvent(type: "SPEECH_STARTED" | "SPEECH_ENDED"): void {
  switch (type) {
    case "SPEECH_STARTED":
      // Walking and jumping use audio as movement cues, not spoken
      // dialogue. Keep EXECUTING so the movement sprite remains visible
      // for the whole displacement / jump while the mp3 plays. Every
      // non-movement command keeps the normal mouth-moving behavior.
      if (!state.lastCommand || !isMovementCommand(state.lastCommand)) {
        transition({ type: "SPEAK" });
      }
      break;
    case "SPEECH_ENDED":
      // <audio>.ended / error. Pick the right "back to" transition
      // based on what the kid should SEE happening next:
      //   - ACTION commands revert to EXECUTING (sprite stays walking /
      //     dancing / celebrating while the visible animation plays out).
      //   - CONTENT commands COMPLETE → IDLE directly. The reducer's
      //     COMPLETE accepts SPEAKING as a valid source state, so the
      //     avatar transitions SPEAKING → IDLE in one step.
      const lastCmd = state.lastCommand;
      if (lastCmd && isActionCommand(lastCmd)) {
        transition({ type: "RETURN_TO_EXECUTION" });
      } else {
        transition({ type: "COMPLETE" });
      }
      // ALWAYS resolve the drainQueue waiter, even if state is the
      // same (action commands). Without this, the queue hangs even
      // though state didn't visibly change.
      if (state.pendingAudioResolver) state.pendingAudioResolver();
      break;
  }
}

/**
 * Delay between preamble SAY and content SAY for the canned content
 * commands (joke/riddle/fact). ~1.2s gives the kid room to absorb
 * "¿Quieren escuchar un chiste?" before "¿Por qué los programadores…"
 * starts — long enough to feel deliberate, short enough not to feel
 * like ROBI stalled. Tuned to typical Spanish preamble audio length
 * (~1-2s) plus a small beat to separate the two voices.
 */
/**
 * Buffer added on top of the preamble audio duration before
 * broadcasting the content SAY for TELL_JOKE/RIDDLE/FACT. Covers
 * the WebSocket round-trip + the client's `audio.ended` event firing
 * + browser audio decode tail. Without this, `playSay()` on the client
 * calls `stopAudio()` while the preamble is still fading out — kid
 * hears the last syllable cut.
 *
 * 100ms is empirically enough: typical WS roundtrip + audio.end
 * latency in browser <80ms. Bump to 150-200 if you ever switch to
 * lower-bitrate mp3s where the tail stretches.
 */
const CONTENT_BUFFER_MS = 100;

// Re-export so consumers can do everything from one module if they like.
export type { RobiState, Position };
