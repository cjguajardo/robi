# AGENTS — ROBI

Notes for AI agents working on this codebase. **The source of truth lives
in [`docs/`](./README.md).** This file is a table of contents plus a
short list of workflow rules and invariants — keep it short, do not
duplicate content from `docs/` here.

---

## 1. Where to look

| Need | File |
|---|---|
| Per-command flow / state / audio / sprite / tweak points | `docs/actions/<command>.md` |
| State machine, audio catalog, sprite system, realtime patterns, invariants | [`docs/references.md`](./references.md) |
| Product doc (qué) | [`docs/PRD.md`](./PRD.md) |
| Architecture doc (cómo) | [`docs/DESIGN.md`](./DESIGN.md) |
| Voice script (audios) | [`docs/scripts.md`](./scripts.md) |
| ANSWER_QUESTION deep-dive (only LLM-using command) | [`docs/actions/answer-question.md`](./actions/answer-question.md) |

Start with [`docs/README.md`](./README.md) for the index.

---

## 2. Workflow rules

Follow these whenever you change code or docs:

1. **Read first.** Find the relevant doc, follow its `file:line` refs
   before touching anything. The "Diagnóstico de ruido" and "Puntos de
   tweak" sections in each `actions/*.md` map symptoms/intents to exact
   locations.
2. **Trace before changing.** The state-machine table in each action file
   is the contract. Don't diverge silently.
3. **Edit doc + code together.** Change the reducer → update the
   `State machine` row in the relevant `actions/*.md`. Add a command →
   follow the checklist at the bottom of `docs/README.md`.
4. **Tests stay green.** `pnpm test` (vitest, 127 tests today). New
   behavior → new test cases. Run before committing.
5. **Conventional commits.** No `Co-Authored-By`, no AI attribution, no
   skip-hooks. Check `git status` + `git diff --cached --shortstat` before
   committing.
6. **No `pnpm build` unless explicitly asked.** Same for `git config`,
   force-push, empty commits.
7. **Verify technical claims against code.** `cat` the file. `file:line`
   refs in docs may be stale after refactors — confirm before acting.
   Don't agree to claims without evidence.
8. **One thing at a time.** Don't refactor unrelated code while fixing
   a bug. Smallest change that solves the problem.

---

## 3. Invariants — the short list

The full list of non-obvious behaviors is in
[`docs/references.md#8-invariantes-no-obvios`](./references.md#8-invariantes-no-obvios).
Only the rules that bite new contributors most often:

- **Single shared world** — one `state` object in
  `src/lib/realtime/server.ts`. No sessions, no query params, no
  envelopes. If you need isolation, run another process on another port.
- **Reducer never touches audio.** Audio orchestration lives in the WS
  layer (`drainQueue` + `waitForSpeechEnded`). Keep them separate; the
  reducer is a pure function for testability.
- **ANSWER_QUESTION is the only LLM path.** Don't generalize it into a
  helper until a second LLM-using command exists.
- **Audio lifecycle depends on the display peer.** Server's
  `waitForSpeechEnded()` blocks on `SPEECH_ENDED` from the client. If
  the display is down, the audio-duration-aware safety timer (default 8s ceiling, or `audioDurationMs + 2s` for catalog audios) keeps the queue moving.
- **Don't store anything persistent.** PRD §14: no DB, no auth, no
  cookies, no session history. Each command is stateless.
- **Waiter pattern on preamble + content**: mount the
  `waitForSpeechEnded()` AFTER broadcasting the preamble, NOT before.
  See `docs/actions/tell-joke.md#gotcha-del-waiter`.

---

## 4. Touching this file

If you find a doc is wrong (code drift, stale `file:line`, unclear
section), fix it in the same change that fixes the underlying issue —
don't ship a code change that contradicts the docs.

If you find yourself wanting to add content here, ask: is it really a
**meta-rule** (about how to work in this repo), or is it **domain
content** (about how the system works)? Domain content goes in
`docs/references.md` or the relevant `docs/actions/*.md`. Only meta-rules
live here.
