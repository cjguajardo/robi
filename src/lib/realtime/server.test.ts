import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetForTesting,
  _safetyTimerDurationMs,
  _setAudioTimeoutForTesting,
  attachPeer,
  detachPeer,
  ingestCommand,
  ingestPresentationGoto,
  ingestStageItemRequest,
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
 * Also waits long enough for action commands to reach IDLE. WALK visual
 * time overlaps audio; the other action tracks retain their post-audio
 * hold. ~900ms covers the longest action used by this helper.
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

  it("synchronizes presentation navigation and includes it on reconnect", () => {
    const first = makePeer();
    attachPeer(first.handle);
    first.events.length = 0;

    expect(ingestPresentationGoto(4)).toEqual({
      currentSlide: 4,
      totalSlides: 7,
    });
    expect(first.events).toContainEqual({
      type: "PRESENTATION_CHANGED",
      payload: { currentSlide: 4, totalSlides: 7 },
    });

    const late = makePeer();
    const snapshot = attachPeer(late.handle);
    expect(snapshot.presentation).toEqual({
      currentSlide: 4,
      totalSlides: 7,
    });
    detachPeer(first.handle);
    detachPeer(late.handle);
  });

  it.each([0, 8, 2.5, "3", null])(
    "rejects invalid presentation slide %s",
    (slide) => {
      const { events, handle } = makePeer();
      attachPeer(handle);
      events.length = 0;

      expect(ingestPresentationGoto(slide)).toEqual({
        currentSlide: 1,
        totalSlides: 7,
      });
      expect(events).not.toContainEqual(
        expect.objectContaining({ type: "PRESENTATION_CHANGED" }),
      );
      detachPeer(handle);
    },
  );

  it("creates one shared random stage item from the selected placement", () => {
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;

    const item = ingestStageItemRequest("LEFT", () => 0);

    expect(item).toEqual({
      kind: "STAR",
      placement: "LEFT",
      position: { x: -5, y: 0 },
      distanceSteps: 5,
    });
    expect(readSnapshot().stageItem).toEqual(item);
    expect(events).toContainEqual({
      type: "STAGE_ITEM_CHANGED",
      payload: item,
    });
    detachPeer(handle);
  });

  it("rejects an invalid stage placement without changing the snapshot", () => {
    expect(ingestStageItemRequest("CENTER")).toBeNull();
    expect(readSnapshot().stageItem).toBeNull();
  });

  it("removes an above object when JUMP reaches its visual apex", async () => {
    vi.useFakeTimers();
    try {
      const { events, handle } = makePeer();
      attachPeer(handle);
      ingestStageItemRequest("ABOVE", () => 0);
      events.length = 0;

      ingestCommand({ type: "JUMP" });
      await vi.advanceTimersByTimeAsync(349);
      expect(readSnapshot().stageItem).not.toBeNull();

      await vi.advanceTimersByTimeAsync(1);
      expect(readSnapshot().stageItem).toBeNull();
      expect(events).toContainEqual({
        type: "STAGE_ITEM_CHANGED",
        payload: null,
      });
      detachPeer(handle);
    } finally {
      _resetForTesting();
      vi.useRealTimers();
    }
  });

  it("removes a side object only when the walking transition reaches it", async () => {
    vi.useFakeTimers();
    try {
      const { events, handle } = makePeer();
      attachPeer(handle);
      ingestStageItemRequest("RIGHT", () => 0);
      events.length = 0;

      ingestCommand({ type: "WALK_RIGHT", steps: 5 });
      expect(readSnapshot().position).toEqual({ x: 5, y: 0 });
      expect(events.some((event) => event.type === "SAY")).toBe(true);
      await vi.advanceTimersByTimeAsync(1749);
      expect(readSnapshot().stageItem).not.toBeNull();

      await vi.advanceTimersByTimeAsync(1);
      expect(readSnapshot().stageItem).toBeNull();
      expect(events).toContainEqual({
        type: "STAGE_ITEM_CHANGED",
        payload: null,
      });
      detachPeer(handle);
    } finally {
      _resetForTesting();
      vi.useRealTimers();
    }
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
    // JUMP has no pendingMove, so APPLY_MOVEMENT never
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

  it("WALK_LEFT starts translating while ROBI says the direction", () => {
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;
    ingestCommand({ type: "WALK_LEFT", steps: 1 });
    const snap = readSnapshot();
    expect(snap.direction).toBe("WEST");
    expect(snap.position).toEqual({ x: -1, y: 0 });
    expect(events.some((event) => event.type === "SAY")).toBe(true);
    detachPeer(handle);
  });

  it("multi-step WALK_RIGHT starts the full visual translation immediately", () => {
    const { handle } = makePeer();
    attachPeer(handle);
    ingestCommand({ type: "WALK_RIGHT", steps: 3 });
    const snap = readSnapshot();
    expect(snap.position).toEqual({ x: 3, y: 0 });
    expect(snap.direction).toBe("EAST");
    detachPeer(handle);
  });

  it("WORLD_CHANGED broadcasts direction and destination before audio ends", () => {
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;
    ingestCommand({ type: "WALK_RIGHT", steps: 2 });
    const worldChanges = events.filter((event) => event.type === "WORLD_CHANGED");
    expect(worldChanges).toHaveLength(2);
    const destination = worldChanges[1];
    if (destination?.type === "WORLD_CHANGED") {
      expect(destination.payload.position).toEqual({ x: 2, y: 0 });
      expect(destination.payload.direction).toBe("EAST");
    }
    detachPeer(handle);
  });

  it("does not defer an additional position update until after audio", async () => {
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;
    ingestCommand({ type: "WALK_LEFT", steps: 1 });
    const beforeAudioEnds = events.filter((event) => event.type === "WORLD_CHANGED");
    expect(beforeAudioEnds).toHaveLength(2);
    expect(readSnapshot().position).toEqual({ x: -1, y: 0 });

    await completeAudio();
    const worldChanges = events.filter((e) => e.type === "WORLD_CHANGED");
    expect(worldChanges).toHaveLength(2);
    detachPeer(handle);
  });

  it("RESET clears the complete stage and leaves ROBI sleeping", () => {
    const { events, handle } = makePeer();
    attachPeer(handle);
    ingestStageItemRequest("RIGHT", () => 0);
    ingestCommand({ type: "WALK_RIGHT", steps: 2 }, "camina a la derecha");
    ingestWorldEvent("PAUSE");
    events.length = 0;

    ingestWorldEvent("RESET");

    const snap = readSnapshot();
    expect(events.some((e) => e.type === "RESET")).toBe(true);
    expect(events.some((e) => e.type === "STATE_CHANGED" && e.payload === "SLEEPING")).toBe(true);
    expect(snap).toMatchObject({
      state: "SLEEPING",
      position: { x: 0, y: 0 },
      direction: "SOUTH",
      paused: false,
      lastTranscript: "",
      lastCommand: null,
      stageItem: null,
    });
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
    ingestCommand({ type: "DANCE" });
    ingestSpeechEvent("SPEECH_STARTED");

    expect(events.some(
      (e) => e.type === "STATE_CHANGED" && e.payload === "SPEAKING",
    )).toBe(true);
    detachPeer(handle);
  });

  it("JUMP keeps the jumping state while its sound plays", () => {
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;

    ingestCommand({ type: "JUMP" });

    const commandIndex = events.findIndex(
      (event) => event.type === "COMMAND" && event.payload.type === "JUMP",
    );
    const sayIndex = events.findIndex(
      (event) =>
        event.type === "SAY" &&
        event.payload.audioUrl?.startsWith("/audio/jump-") === true,
    );
    expect(commandIndex).toBeGreaterThanOrEqual(0);
    expect(sayIndex).toBeGreaterThan(commandIndex);

    events.length = 0;
    ingestSpeechEvent("SPEECH_STARTED");

    expect(readSnapshot().state).toBe("EXECUTING");
    expect(events.some(
      (event) => event.type === "STATE_CHANGED" && event.payload === "SPEAKING",
    )).toBe(false);

    ingestSpeechEvent("SPEECH_ENDED");
    expect(readSnapshot().state).toBe("EXECUTING");
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
    // Companion to the THINKING test. Speaking action commands (WALK,
    // DANCE, etc.) revert to EXECUTING on SPEECH_ENDED so the
    // command-aware sprite (walking / dancing / celebrating) plays
    // out until drainQueue's post-audio delay completes.
    const { events, handle } = makePeer();
    attachPeer(handle);
    events.length = 0;

    ingestCommand({ type: "DANCE" });
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

  it("releases the queue lock after speech and concurrent walking finish", async () => {
    const { handle } = makePeer();
    attachPeer(handle);
    ingestCommand({ type: "WALK_LEFT", steps: 1 });
    // Should be locked (state.processing === true).
    const { ingestCommand: ic, readSnapshot } = await import("./server");
    // A second command is rejected while the first command is active.
    expect(ic({ type: "WALK_RIGHT", steps: 1 }).type).toBe("STOP");
    const snap = readSnapshot();
    expect(snap.lastCommand?.type).toBeDefined();
    // Now manually complete the audio for the FIRST command.
    ingestSpeechEvent("SPEECH_STARTED");
    await new Promise((r) => setTimeout(r, 20));
    ingestSpeechEvent("SPEECH_ENDED");
    // One step has a 400ms visual duration that started with the SAY.
    // Audio ended after ~20ms, so wait for the remaining walk time.
    await new Promise((r) => setTimeout(r, 430));
    // Both concurrent tracks have completed; use a fresh command as a probe.
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
