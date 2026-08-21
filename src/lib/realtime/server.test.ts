import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetForTesting,
  _safetyTimerDurationMs,
  _setAudioTimeoutForTesting,
  attachPeer,
  detachPeer,
  ingestCommand,
  ingestSpeechEvent,
  ingestWorldEvent,
  readSnapshot,
} from "./server";
import { preambleDurationMs } from "@/lib/robi/responses";
import type { RealtimeEvent } from "@/types/robi";

/**
 * Helper: how long to wait for the dynamic preamble→content gap in
 * tests. Reads the actual preamble duration from the catalog (so
 * tests stay in sync with audios.json) and adds a small buffer for
 * the test runtime overhead.
 */
function preambleGapMs(kind: "joke" | "riddle" | "fact"): number {
  return preambleDurationMs(kind) + 200;
}

function makePeer() {
  const events: RealtimeEvent[] = [];
  return {
    events,
    handle: {
      send: (event: RealtimeEvent) => events.push(event),
    },
  };
}

/**
 * Run an async test body after firing `ingestCommand`. Drives the audio
 * lifecycle to completion: dispatches SPEECH_STARTED, then a short
 * delay (simulating audio playback), then SPEECH_ENDED. Lets the test
 * move on without waiting the production 8s safety timer.
 *
 * Also waits long enough for action commands (WALK/JUMP/DANCE/CELEBRATE)
 * to clear their post-audio `actionAnimationMs` delay so the next
 * STATE_CHANGED reaches IDLE. ~900ms covers the longest action in tests
 * (JUMP=700ms + drain overhead).
 */
async function completeAudio(): Promise<void> {
  ingestSpeechEvent("SPEECH_STARTED");
  await new Promise((r) => setTimeout(r, 20));
  ingestSpeechEvent("SPEECH_ENDED");
  // Action commands stay in EXECUTING for `actionAnimationMs` ms
  // before transitioning to IDLE. 900ms > longest (JUMP=700ms).
  await new Promise((r) => setTimeout(r, 900));
}

describe("realtime hub", () => {
  beforeEach(() => {
    _resetForTesting();
    _setAudioTimeoutForTesting(200);
  });

  it("attaches a peer and sends SNAPSHOT", () => {
    const { events, handle } = makePeer();
    const snap = attachPeer(handle);
    expect(events.some((e) => e.type === "SNAPSHOT")).toBe(true);
    expect(snap.state).toBe("SLEEPING");
    detachPeer(handle);
  });

  it("ingestCommand validates, queues, and broadcasts EXECUTING then IDLE", async () => {
    const { events, handle } = makePeer();
    attachPeer(handle);

    ingestCommand({ type: "WALK_LEFT", steps: 1 });

    expect(events.some((e) => e.type === "COMMAND")).toBe(true);
    expect(events.some((e) => e.type === "STATE_CHANGED" && e.payload === "EXECUTING")).toBe(true);

    await completeAudio();

    const states = events
      .filter((e) => e.type === "STATE_CHANGED")
      .map((e) => (e as { type: "STATE_CHANGED"; payload: string }).payload);
    expect(states).toContain("IDLE");

    detachPeer(handle);
  });

  it("rejects commands when paused", () => {
    const { handle } = makePeer();
    attachPeer(handle);
    ingestWorldEvent("PAUSE");
    const result = ingestCommand({ type: "WALK_RIGHT", steps: 2 });
    expect(result.type).toBe("STOP"); // pause guard returns STOP
    detachPeer(handle);
  });

  it("UNKNOWN command moves state to CONFUSED", () => {
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;
    ingestCommand({ type: "UNKNOWN", raw: "fly" });
    expect(events.some((e) => e.type === "STATE_CHANGED" && e.payload === "CONFUSED")).toBe(true);
    detachPeer(handle);
  });

  it("TELL_JOKE broadcasts SAY: preamble then joke (after audio lifecycle)", async () => {
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;
    ingestCommand({ type: "TELL_JOKE" });

    // Drive the brief preamble audio to completion so drainQueue
    // proceeds to the dynamic preamble→content gap + content SAY setup.
    ingestSpeechEvent("SPEECH_STARTED");
    await new Promise((r) => setTimeout(r, 30));
    ingestSpeechEvent("SPEECH_ENDED");
    // Final audio lifecycle for the content SAY (the drainQueue will
    // be waiting on this after the dynamic gap).
    await new Promise((r) => setTimeout(r, preambleGapMs("joke")));
    ingestSpeechEvent("SPEECH_STARTED");
    await new Promise((r) => setTimeout(r, 30));
    ingestSpeechEvent("SPEECH_ENDED");
    // TELL_JOKE/RIDDLE/FACT are CONTENT commands (not action), so
    // drainQueue completes immediately after audio ends — minimal wait.
    await new Promise((r) => setTimeout(r, 100));

    const says = events.filter((e) => e.type === "SAY");
    expect(says.length).toBeGreaterThanOrEqual(2);
    const joke = says[says.length - 1];
    if (joke && joke.type === "SAY") {
      expect(joke.payload.text).toMatch(/[Pp]ixel|[Cc]PU|[Cc]hau|[Cc]ero|variable|programador/);
      expect(joke.payload.audioUrl).toMatch(/^\/audio\/joke-\d+\.mp3$/);
    }
    // Goes through EXECUTING and back to IDLE — never to CONFUSED.
    const states = events
      .filter((e) => e.type === "STATE_CHANGED")
      .map((e) => (e as { type: "STATE_CHANGED"; payload: string }).payload);
    expect(states).toContain("EXECUTING");
    expect(states).not.toContain("CONFUSED");
    detachPeer(handle);
  });

  it("ANSWER_QUESTION without an API key falls back to a friendly SAY", async () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const { events, handle } = makePeer();
      attachPeer(handle);
      events.length = 0;
      ingestCommand({ type: "ANSWER_QUESTION", question: "que es un robot" });
      // ANSWER_QUESTION broadcasts 2 SAYs: a preamble (fills silence
      // while the LLM responds), then the answer (or fallback).
      // Wait for both audio lifecycles to complete.
      ingestSpeechEvent("SPEECH_STARTED");  // preamble
      await new Promise((r) => setTimeout(r, 30));
      ingestSpeechEvent("SPEECH_ENDED");
      // After preamble end: server awaits LLM (no api key → fallback).
      // Fallback path: ANSWER_QUESTION_FALLBACK from audio catalog.
      // We trigger that audio lifecycle manually.
      await new Promise((r) => setTimeout(r, 100));
      ingestSpeechEvent("SPEECH_STARTED");  // answer
      await new Promise((r) => setTimeout(r, 30));
      ingestSpeechEvent("SPEECH_ENDED");
      await new Promise((r) => setTimeout(r, 30));

      const says = events.filter((e) => e.type === "SAY");
      expect(says.length).toBe(2);

      const preamble = says[0];
      const answer = says[1];
      if (
        preamble && preamble.type === "SAY" &&
        answer && answer.type === "SAY"
      ) {
        expect(preamble.payload.audioUrl).toMatch(/^\/audio\/question-preamble-\d+\.mp3$/);
        expect(answer.payload.text.length).toBeGreaterThan(0);
        expect(answer.payload.audioUrl).toMatch(/^\/audio\/question-fallback-\d+\.mp3$/);
      }
      detachPeer(handle);
    } finally {
      if (original !== undefined) process.env.OPENAI_API_KEY = original;
    }
  });

  it("JUMP is in-place (no position change) and broadcasts EXECUTING → IDLE", async () => {
    // User requested no lateral advancement for JUMP — the avatar
    // stays in its grid square and uses the CSS avatar-jump translateY
    // for the visual lift. Confirmed: no second WORLD_CHANGED with a
    // new position is broadcast for JUMP.
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;
    ingestCommand({ type: "JUMP" });
    await completeAudio();

    const states = events
      .filter((e) => e.type === "STATE_CHANGED")
      .map((e) => (e as { type: "STATE_CHANGED"; payload: string }).payload);
    expect(states).toContain("EXECUTING");
    expect(states).toContain("IDLE");
    expect(states).not.toContain("CONFUSED");
    const say = events.find((e) => e.type === "SAY");
    expect(say).toBeDefined();
    // JUMP has no pendingMove, so the post-audio APPLY_MOVEMENT never
    // fires — only the initial EXECUTE-time WORLD_CHANGED is broadcast,
    // and it carries the SAME position (unchanged) and same direction
    // (JUMP doesn't rotate).
    const worldChanges = events.filter((e) => e.type === "WORLD_CHANGED");
    expect(worldChanges.length).toBe(1);
    if (worldChanges[0]?.type === "WORLD_CHANGED") {
      expect(worldChanges[0].payload.position).toEqual({ x: 0, y: 0 });
    }
    detachPeer(handle);
  });

  it("WALK_LEFT rotates ROBI to WEST and queues translation as pendingMove (no eager position change)", () => {
    // The kid sees ROBI turn west and say "¡A la izquierda!" in place.
    // The actual translation is dispatched AFTER audio ends, not here.
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;
    ingestCommand({ type: "WALK_LEFT", steps: 1 });
    const snap = readSnapshot();
    expect(snap.direction).toBe("WEST");
    expect(snap.position).toEqual({ x: 0, y: 0 }); // NOT moved yet
    detachPeer(handle);
  });

  it("multi-step WALK_RIGHT queues the full translation in pendingMove", () => {
    const { handle } = makePeer();
    attachPeer(handle);
    ingestCommand({ type: "WALK_RIGHT", steps: 3 });
    const snap = readSnapshot();
    expect(snap.position).toEqual({ x: 0, y: 0 }); // NOT moved yet
    expect(snap.direction).toBe("EAST");
    detachPeer(handle);
  });

  it("WORLD_CHANGED broadcasts the new direction immediately, position unchanged (deferred)", async () => {
    // First WORLD_CHANGED arrives right after EXECUTE — direction is
    // already updated (ROBI faces the new heading) but position is
    // still the OLD value (translation is deferred until audio ends).
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;
    ingestCommand({ type: "WALK_RIGHT", steps: 2 });
    const worldChanged = events.find((e) => e.type === "WORLD_CHANGED");
    expect(worldChanged).toBeDefined();
    if (worldChanged && worldChanged.type === "WORLD_CHANGED") {
      expect(worldChanged.payload.position).toEqual({ x: 0, y: 0 });
      expect(worldChanged.payload.direction).toBe("EAST");
    }
    detachPeer(handle);
  });

  it("WORLD_CHANGED broadcasts the new position a SECOND time, AFTER audio ends", async () => {
    // The second WORLD_CHANGED arrives AFTER drainQueue dispatches
    // APPLY_MOVEMENT (post-audio). Now position reflects the actual
    // translation the kid visibly watched happen.
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;
    ingestCommand({ type: "WALK_LEFT", steps: 1 });
    await completeAudio();
    const worldChanges = events.filter((e) => e.type === "WORLD_CHANGED");
    expect(worldChanges.length).toBe(2);
    // First (immediate): position unchanged, direction updated.
    const first = worldChanges[0];
    if (first && first.type === "WORLD_CHANGED") {
      expect(first.payload.position).toEqual({ x: 0, y: 0 });
      expect(first.payload.direction).toBe("WEST");
    }
    // Second (post-audio): position changes, direction unchanged.
    const second = worldChanges[1];
    if (second && second.type === "WORLD_CHANGED") {
      expect(second.payload.position).toEqual({ x: -1, y: 0 });
      expect(second.payload.direction).toBe("WEST");
    }
    detachPeer(handle);
  });

  it("RESET clears state and broadcasts", () => {
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;
    ingestWorldEvent("RESET");
    expect(events.some((e) => e.type === "RESET")).toBe(true);
    expect(events.some((e) => e.type === "STATE_CHANGED" && e.payload === "IDLE")).toBe(true);
    expect(readSnapshot().position).toEqual({ x: 0, y: 0 });
    detachPeer(handle);
  });

  it("TELL_RIDDLE broadcasts a riddle-preamble then the riddle", async () => {
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;
    ingestCommand({ type: "TELL_RIDDLE" });

    // Preamble lifecycle
    ingestSpeechEvent("SPEECH_STARTED");
    await new Promise((r) => setTimeout(r, 30));
    ingestSpeechEvent("SPEECH_ENDED");
    // Content lifecycle (dynamic gap based on actual preamble duration)
    await new Promise((r) => setTimeout(r, preambleGapMs("riddle")));
    ingestSpeechEvent("SPEECH_STARTED");
    await new Promise((r) => setTimeout(r, 30));
    ingestSpeechEvent("SPEECH_ENDED");
    await new Promise((r) => setTimeout(r, 100));

    const says = events.filter((e) => e.type === "SAY");
    expect(says.length).toBeGreaterThanOrEqual(2);
    const first = says[0];
    const last = says[says.length - 1];
    if (first && first.type === "SAY" && last && last.type === "SAY") {
      expect(first.payload.audioUrl).toMatch(/^\/audio\/riddle-preamble-\d+\.mp3$/);
      expect(last.payload.audioUrl).toMatch(/^\/audio\/riddle-\d+\.mp3$/);
    }
    detachPeer(handle);
  });

  it("TELL_FACT broadcasts a fact-preamble then the fact", async () => {
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;
    ingestCommand({ type: "TELL_FACT" });

    ingestSpeechEvent("SPEECH_STARTED");
    await new Promise((r) => setTimeout(r, 30));
    ingestSpeechEvent("SPEECH_ENDED");
    // Dynamic gap based on actual preamble duration
    await new Promise((r) => setTimeout(r, preambleGapMs("fact")));
    ingestSpeechEvent("SPEECH_STARTED");
    await new Promise((r) => setTimeout(r, 30));
    ingestSpeechEvent("SPEECH_ENDED");
    await new Promise((r) => setTimeout(r, 100));

    const says = events.filter((e) => e.type === "SAY");
    expect(says.length).toBeGreaterThanOrEqual(2);
    const first = says[0];
    const last = says[says.length - 1];
    if (first && first.type === "SAY" && last && last.type === "SAY") {
      expect(first.payload.audioUrl).toMatch(/^\/audio\/fact-preamble-\d+\.mp3$/);
      expect(last.payload.audioUrl).toMatch(/^\/audio\/fact-\d+\.mp3$/);
    }
    detachPeer(handle);
  });

  it("ANSWER_QUESTION preamble is broadcast immediately (don't wait for LLM)", async () => {
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;
    ingestCommand({ type: "ANSWER_QUESTION", question: "x" });
    // 50ms — preamble SAY should fire synchronously.
    await new Promise((r) => setTimeout(r, 50));
    const preambleSAY = events.find(
      (e) => e.type === "SAY" && (e.payload as { audioUrl?: string }).audioUrl
        ?.includes("question-preamble"),
    );
    expect(preambleSAY, "preamble SAY should arrive immediately").toBeDefined();
    detachPeer(handle);
  });

  it("ANSWER_QUESTION bundles the LLM answer as a data:audio/mpeg URL (no client /api/tts roundtrip)", async () => {
    // Mock both the LLM and the TTS so the test is hermetic (no real
    // OpenAI calls). The point of this test is to verify the SERVER
    // side pre-synthesizes audio and bundles it as a data URL — the
    // display client must NOT need a second roundtrip to /api/tts.
    const llm = await import("@/lib/llm/answer-question");
    const tts = await import("@/lib/tts/synthesize");
    const llmSpy = vi
      .spyOn(llm, "answerQuestion")
      .mockResolvedValue({ text: "Los robots son como nosotros pero con circuitos." });
    // Tiny valid mp3 header — synthesizeSpeech returns a Buffer; the
    // exact bytes don't matter, only that the data URL wraps them.
    const fakeMp3 = Buffer.from([0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const ttsSpy = vi.spyOn(tts, "synthesizeSpeech").mockResolvedValue(fakeMp3);
    try {
      const { events, handle } = makePeer();
      attachPeer(handle);
      events.length = 0;
      ingestCommand({ type: "ANSWER_QUESTION", question: "que es un robot" });

      // Drive both audio lifecycles to completion.
      ingestSpeechEvent("SPEECH_STARTED"); // preamble
      await new Promise((r) => setTimeout(r, 30));
      ingestSpeechEvent("SPEECH_ENDED");
      await new Promise((r) => setTimeout(r, 50));
      ingestSpeechEvent("SPEECH_STARTED"); // answer
      await new Promise((r) => setTimeout(r, 30));
      ingestSpeechEvent("SPEECH_ENDED");
      await new Promise((r) => setTimeout(r, 30));

      const says = events.filter((e) => e.type === "SAY");
      expect(says.length).toBe(2);
      const answer = says[1];
      if (answer && answer.type === "SAY") {
        expect(answer.payload.text).toBe(
          "Los robots son como nosotros pero con circuitos.",
        );
        // The contract: audioUrl is a data URL (mp3), not a /api/tts
        // reference. This is what lets the client play without a
        // second roundtrip.
        expect(answer.payload.audioUrl).toMatch(/^data:audio\/mpeg;base64,/);
      }
      // Server-side TTS was called exactly once (for the answer).
      expect(ttsSpy).toHaveBeenCalledTimes(1);
      expect(llmSpy).toHaveBeenCalledTimes(1);
      detachPeer(handle);
    } finally {
      llmSpy.mockRestore();
      ttsSpy.mockRestore();
    }
  });
});

describe("audio lifecycle events (SPEECH_STARTED / SPEECH_ENDED)", () => {
  beforeEach(() => {
    _resetForTesting();
    _setAudioTimeoutForTesting(200);
  });

  it("SPEECH_STARTED drives the state to SPEAKING (mouth moving)", () => {
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;

    // Land in EXECUTING first (manual command).
    ingestCommand({ type: "JUMP" });
    ingestSpeechEvent("SPEECH_STARTED");

    expect(events.some(
      (e) => e.type === "STATE_CHANGED" && e.payload === "SPEAKING",
    )).toBe(true);
    detachPeer(handle);
  });

  it("SPEECH_ENDED drives the state straight to IDLE for content commands", () => {
    // After audio playback ends, content commands (TELL_JOKE,
    // TELL_RIDDLE, TELL_FACT, ANSWER_QUESTION, UNKNOWN, etc.) skip
    // the intermediate THINKING pose and go straight to IDLE. Earlier
    // revisions bounced through THINKING here, but the intermediate
    // broadcast left the avatar on the 4-frame thinking loop long
    // enough to be visible — especially during the preamble→content
    // gap of TELL_FACT and similar commands. ACTION commands
    // (WALK / JUMP / DANCE / CELEBRATE / GREET / etc.) fall back to
    // EXECUTING instead — see the next test.
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;

    // UNKNOWN uses UNKNOWN-01/02 audios from the catalog (content
    // branch in ingestSpeechEvent), not an action branch.
    ingestCommand({ type: "UNKNOWN", raw: "fly" });
    ingestSpeechEvent("SPEECH_STARTED");
    events.length = 0;
    ingestSpeechEvent("SPEECH_ENDED");

    const states = events
      .filter((e) => e.type === "STATE_CHANGED")
      .map((e) => (e as { type: "STATE_CHANGED"; payload: string }).payload);
    // First non-action-content transition must be IDLE, never THINKING.
    expect(states[0]).toBe("IDLE");
    // And THINKING must NOT appear in the post-SPEECH_ENDED stream.
    expect(states).not.toContain("THINKING");
    detachPeer(handle);
  });

  it("SPEECH_ENDED drives action commands back to EXECUTING (action sprite)", () => {
    // Companion to the THINKING test. Action commands (WALK, JUMP,
    // DANCE, etc.) revert to EXECUTING on SPEECH_ENDED so the
    // command-aware sprite (walking / dancing / celebrating) plays
    // out until drainQueue's post-audio delay completes.
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;

    ingestCommand({ type: "JUMP" });
    ingestSpeechEvent("SPEECH_STARTED");
    events.length = 0;
    ingestSpeechEvent("SPEECH_ENDED");

    // The state should land on EXECUTING (kept for action animation),
    // not THINKING (which is the content-command path).
    expect(events.some(
      (e) => e.type === "STATE_CHANGED" && e.payload === "EXECUTING",
    )).toBe(true);
    expect(events.some(
      (e) => e.type === "STATE_CHANGED" && e.payload === "THINKING",
    )).toBe(false);
    detachPeer(handle);
  });

  it("TELL_FACT state sequence ends at IDLE without lingering on THINKING (regression)", async () => {
    // Regression for the bug where content commands bounced through
    // THINKING on SPEECH_ENDED. The intermediate broadcast left the
    // avatar on the 4-frame thinking loop long enough to be visible —
    // especially during the preamble→content gap of TELL_FACT and
    // similar commands, where the gap is preambleDurationMs +
    // CONTENT_BUFFER_MS. Content commands must now go SPEAKING → IDLE.
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;

    ingestCommand({ type: "TELL_FACT" });

    // Drive the preamble lifecycle.
    ingestSpeechEvent("SPEECH_STARTED");
    await new Promise((r) => setTimeout(r, 30));
    ingestSpeechEvent("SPEECH_ENDED");
    // Wait for the preamble gap.
    await new Promise((r) => setTimeout(r, preambleGapMs("fact")));

    // Drive the content lifecycle.
    ingestSpeechEvent("SPEECH_STARTED");
    await new Promise((r) => setTimeout(r, 30));
    ingestSpeechEvent("SPEECH_ENDED");
    await new Promise((r) => setTimeout(r, 200));

    const states = events
      .filter((e) => e.type === "STATE_CHANGED")
      .map((e) => (e as { type: "STATE_CHANGED"; payload: string }).payload);

    // Exact sequence: EXECUTING → SPEAKING → IDLE → SPEAKING → IDLE.
    // THINKING must never appear. Final state is IDLE.
    expect(states).not.toContain("THINKING");
    expect(states[states.length - 1]).toBe("IDLE");
    detachPeer(handle);
  });

  it("SPEECH_ENDED unblocks drainQueue, releasing the queue lock", async () => {
    const { handle } = makePeer();
    attachPeer(handle);
    ingestCommand({ type: "WALK_LEFT", steps: 1 });
    // Should be locked (state.processing === true).
    const { ingestCommand: ic, readSnapshot } = await import("./server");
    // We can fire a second command — it'll queue. Snapshot state.
    ic({ type: "WALK_RIGHT", steps: 1 });
    const snap = readSnapshot();
    expect(snap.lastCommand?.type).toBeDefined();
    // Now manually complete the audio for the FIRST command.
    ingestSpeechEvent("SPEECH_STARTED");
    await new Promise((r) => setTimeout(r, 20));
    ingestSpeechEvent("SPEECH_ENDED");
    await new Promise((r) => setTimeout(r, 50));
    // After audio ended, processing should be false. The queued
    // WALK_RIGHT should now run.
    await new Promise((r) => setTimeout(r, 80));
    // After both commands completed, state.processing should be false
    // and the queue empty. Use a fresh command as a probe.
    const probe = ingestCommand({ type: "JUMP" });
    expect(probe.type).toBe("JUMP");  // accepted (not paused, not processing)
    detachPeer(handle);
  });

  it("safety timer is sized off audio durationMs for long content audios (regression)", () => {
    // Regression for the bug where the safety timer was a fixed 8s
    // ceiling, but several pre-generated content audios exceed 8s
    // (fact-01 is 13.2s, riddle-03 is 9.4s, joke-01 is 8.1s, joke-05
    // is 9.0s — see sonidos/audios.json). With the fixed ceiling,
    // the safety timer fired mid-playback for those audios, the
    // drainQueue proceeded, and the kid heard the next command's
    // SAY cut the previous audio off mid-sentence. Without the
    // duration-aware sizing, every TELL_FACT/TELL_RIDDLE/TELL_JOKE
    // rotation that landed on one of the long files would surface
    // this warning in the server log and clip the audio.
    //
    // We pin the formula directly here — fast, no timer waiting,
    // independent of which audio the rotation picks. beforeEach
    // has set MAX_AUDIO_DURATION_MS to 200; restore the production
    // ceiling so the unknown-duration assertion below checks the
    // real fallback, not the test override.
    _setAudioTimeoutForTesting(8000);
    expect(_safetyTimerDurationMs(13200)).toBe(15200); // fact-01
    expect(_safetyTimerDurationMs(9408)).toBe(11408); // riddle-03
    expect(_safetyTimerDurationMs(8952)).toBe(10952); // joke-05
    expect(_safetyTimerDurationMs(8112)).toBe(10112); // joke-01
    // Short audios: still within the buffer-based formula.
    expect(_safetyTimerDurationMs(1464)).toBe(3464); // walk-left-01
    expect(_safetyTimerDurationMs(2016)).toBe(4016); // fact-preamble-01
    // Unknown duration → falls back to MAX_AUDIO_DURATION_MS (8s).
    expect(_safetyTimerDurationMs(undefined)).toBe(8000);
  });

  it("safety timer kicks in if SPEECH_ENDED never arrives (no hang)", async () => {
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;
    ingestCommand({ type: "WALK_LEFT", steps: 1 });
    // We deliberately do NOT call ingestSpeechEvent("SPEECH_ENDED").
    // The safety timer is now sized off the picked audio's
    // durationMs (walk-left-01.mp3 is ~1.5s) plus a 2s buffer
    // (≈3.5s total). The MAX_AUDIO_DURATION_MS ceiling still applies
    // when no duration is known — verified by separate tests below.
    await new Promise((r) => setTimeout(r, 4000));
    // The safety timer should have fired and the command COMPLETEd.
    const states = events
      .filter((e) => e.type === "STATE_CHANGED")
      .map((e) => (e as { type: "STATE_CHANGED"; payload: string }).payload);
    expect(states).toContain("IDLE");
    detachPeer(handle);
  });

  it("SPEECH_ENDED resolves even if it races ahead of the waiter setup", async () => {
    // Edge case: audio could be SO short that SPEECH_ENDED arrives
    // before waitForSpeechEnded has set up the resolver. The fixed
    // signal in `pendingAudioResolver` should still catch it.
    //
    // We use TELL_JOKE (a content command with a single SAY) so the
    // test doesn't have to wait for `actionAnimationMs`. The waiter
    // resolves the moment SPEECH_ENDED fires, regardless of timing.
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;
    ingestCommand({ type: "TELL_JOKE" });
    // Fire ENDED immediately (race):
    ingestSpeechEvent("SPEECH_ENDED");
    // Drain queue runs microtasks after the resolver fires. TELL_JOKE
    // has actionAnimationMs=0 so it's near-instant; 200ms covers it
    // and any microtask scheduling jitter.
    await new Promise((r) => setTimeout(r, 200));
    const states = events
      .filter((e) => e.type === "STATE_CHANGED")
      .map((e) => (e as { type: "STATE_CHANGED"; payload: string }).payload);
    expect(states).toContain("IDLE");
    detachPeer(handle);
  });
});
