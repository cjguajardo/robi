# AGENTS — ROBI

Notes for AI agents working on this codebase. Complements `PRD.md` (what),
`DESIGN.md` (how), and the per-action files in `actions/` (per-command
flow). This file focuses on **non-obvious behavior** and **invariants**
that an agent would otherwise have to re-derive from code.

---

## Quick map

- **Per-command flow** → `actions/<command>.md` (one file per `RobiCommand`)
- **Global cross-cutting** (state machine, audio catalog, sprite system, realtime patterns) → `references.md`
- **Product doc** (qué) → `PRD.md`
- **Architecture doc** (cómo) → `DESIGN.md`
- **ANSWER_QUESTION deep-dive** (the only LLM-using command) → `actions/answer-question.md`

---

## ANSWER_QUESTION flow (open-ended kid questions)

**See [`actions/answer-question.md`](./actions/answer-question.md) for the
complete flow diagram, state machine, fallback chain, and tweak points.**

This section is kept brief on purpose — the canonical documentation lives
in `actions/answer-question.md`. Highlights that are worth keeping here:

- ANSWER_QUESTION is the **only** command path that touches an LLM at runtime. Everything else uses pre-recorded audio from `sonidos/audios/`.
- Branch lives in `drainQueue()` (`src/lib/realtime/server.ts` ~line 165). Action commands never enter it.
- `src/lib/llm/answer-question.ts` calls `gpt-4o-mini` with a kid-safe system prompt and 15s timeout.
  timeout, network error, empty response).
- **Audio assets** —
  `sonidos/audios/question-preamble-01.mp3` (preamble, kid hears while
  LLM thinks) and `sonidos/audios/question-fallback-NN.mp3` (catalog
  fallback when the LLM is down).

### The pipeline (in T-order)

```
T=0    fork:  broadcast SAY(preamble)        ┐ in parallel
             start LLM.call(question)         ┘

T=L    LLM returns answer text
       |
       v
T=L+T  synthesizeSpeech(answerText) → mp3 buffer
       |
       v
T=L+T+T broadcast SAY({ text, audioUrl: data:audio/mpeg;base64,… })
       |
       v
T=L+T+T+X  client audio ends → SPEECH_ENDED → drainQueue resumes
```

**The fork at T=0 is the only overlap.** Everything after the LLM
resolves is strictly sequential because we need the text to synthesize
and the audio to broadcast. The kid hears the pre-recorded preamble
(~1s) while the model thinks (typically 2-5s); by the time the LLM
returns, the answer audio is already synthesized and ready.

### Why `data:audio/mpeg;base64,…` and not `/api/tts` roundtrip

The alternative was to broadcast `{text}` (no audioUrl) and let the
client fetch `/api/tts` synchronously — that's what the codebase used
to do. It created a perceptible gap between the preamble ending and
the answer starting (~0.5-1.5s for the roundtrip + mp3 decode). With
the data URL approach, the second SAY carries the audio inline and the
client plays it instantly via `audio.src = audioUrl`.

Trade-off: WS message size goes up by ~100-200 KB per question
(base64 overhead). Acceptable because it's a single message per kid
question, not per frame.

### Graceful degradation paths

| What fails | What the kid hears |
|---|---|
| Catalog has no `ANSWER_QUESTION_PREAMBLE` | No preamble, just answer. |
| `OPENAI_API_KEY` not set | Preamble + catalog fallback audio. |
| LLM call times out (>15s) | Preamble + catalog fallback audio. |
| LLM returns empty | Preamble + catalog fallback audio. |
| TTS synthesis fails (after LLM success) | Preamble + text-only SAY → client's existing `/api/tts` fallback runs. |

The fallback path is the existing `ANSWER_QUESTION_FALLBACK` audio
category, picked via `questionFallbackResponse()` in
`src/lib/robi/responses.ts`. It rotates independently.

### State transitions

```
EXECUTING (after transition({EXECUTE}))
   │
   │   preamble SAY broadcasts
   │   kid hears: "¿Sabes qué? Déjame pensar…"
   │
   ▼
THINKING  (display sees SAY → SPEAK_STARTED → SPRITE = SPEAKING;
           the "THINKING" reducer state was set during EXECUTE;
           the SPRITE state is the visible one — see notes below)

   │   LLM + TTS complete; answer SAY broadcasts
   │
   ▼
SPEAKING  (client plays audio from data URL)

   │   audio ends → SPEECH_ENDED → reducer → THINKING
   │   (ANSWER_QUESTION is a CONTENT command — see ingestSpeechEvent)
   │
   ▼
COMPLETE → IDLE
```

The reducer state machine (`THINKING`, `SPEAKING`, etc.) is separate
from the SPRITE state the display renders. During the preamble+answer
both SAYs drive the display to `SPEAKING` (mouth moving); the reducer
state stays at `THINKING` between SAYs because the kid perceives ROBI
as "thinking" until the audio finishes.

### Waiter pattern (read this before touching)

`waitForSpeechEnded()` in `server.ts` returns a Promise that resolves
when the display sends `SPEECH_ENDED`. It's set up BEFORE the
broadcast of the LAST SAY in a command, so a fast-fire SPEECH_ENDED
(very short answer audio) still has someone to resolve.

For ANSWER_QUESTION specifically: the preamble SAY has NO waiter — we
fire it and forget. The waiter is set up before the ANSWER SAY broadcast
only. If you set up a waiter before the preamble, you'll hang forever
when the display sends SPEECH_ENDED for the preamble and nobody
consumes it (it'll resolve immediately, the waitForSpeechEnded for the
answer will then never get its own SPEECH_ENDED).

**Don't add a waiter for the preamble.** This was a bug we almost
shipped — the comment in the code explains it.

### Scope invariant

ANSWER_QUESTION is the ONLY command that:
- Calls an LLM at request time.
- Calls `synthesizeSpeech()` at request time.
- Uses a data URL for `audioUrl` (everything else uses a `/audio/*.mp3`
  static path).

Action commands (WALK_LEFT, JUMP, DANCE, …) and content commands
(TELL_JOKE, TELL_RIDDLE, TELL_FACT) are unchanged — they still pull
pre-recorded audio from the catalog with no LLM, no TTS, no preamble.

If you ever need to add a new LLM-driven command (e.g. TRANSLATE, SING),
follow this same pattern: fork LLM + preamble, then sequential TTS →
SAY(dataUrl). Don't try to make a generic helper in `drainQueue` until
you have a second use case.

### Testing

Hermetic test for the new data-URL path lives in
`src/lib/realtime/server.test.ts` ("ANSWER_QUESTION bundles the LLM
answer as a data:audio/mpeg URL"). It mocks both `@/lib/llm/answer-question`
and `@/lib/tts/synthesize` so no real OpenAI calls happen.

The fallback path (no API key → catalog audio) is covered by
"ANSWER_QUESTION without an API key falls back to a friendly SAY".

### Gotchas

1. **`synthesizeSpeech()` requires `OPENAI_API_KEY`.** If you call it
   with no key, it throws "No TTS provider configured". The ANSWER_QUESTION
   branch catches this and falls back to text-only — the client's
   `/api/tts` endpoint then runs (it also needs the key, so this is a
   double-fail in the no-key case, but the fallback audio already
   covered that path before TTS is even called).

2. **LRU cache matters.** `synthesizeSpeech()` has a 32-entry LRU keyed
   on the input text. If a kid asks the same question twice in a
   session, the second TTS is instant. Don't disable the cache.

3. **Audio lifecycle depends on the display actually playing.** If the
   display peer is disconnected, the safety timer in
   `waitForSpeechEnded()` (8s production, 200ms in tests) fires and
   `drainQueue` proceeds. Without that, the queue would hang.

4. **MP3 buffer is base64-encoded inside a JSON-string WS message.**
   Astro/Node has no problem with ~200KB JSON strings. If you ever
   bump the LLM's `max_tokens` high enough that responses are >30s of
   audio, revisit this — typical answers are 5-15s and stay under
   ~200KB.

---

## Other invariants worth knowing

- **Single shared world** — there is one `state` object in `server.ts`.
  No sessions, no query params, no envelopes. See DESIGN.md §15.
- **Command rejection during processing** — `ingestCommand()` returns
  `{type: "STOP"}` if `state.processing` is true. Commands queue, but
  the simple rejection policy means only one runs at a time.
- **Action vs content commands** — drives whether SPEECH_ENDED reverts
  to `EXECUTING` (action, sprite keeps animating) or `THINKING`
  (content, sprite sits quietly). See `isActionCommand()` in
  `server.ts`. ANSWER_QUESTION is a content command.
- **Reducer never touches audio.** Audio is owned by the WS layer
  (broadcast + waiter); the reducer only emits state. Don't try to
  move audio orchestration into the reducer — it breaks the
  separation that makes both layers testable.
