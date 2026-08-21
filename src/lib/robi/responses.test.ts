// Tests for the dynamic preamble duration helper used by the
// TELL_JOKE / TELL_RIDDLE / TELL_FACT drainQueue branch.

import { describe, expect, it } from "vitest";
import { preambleDurationMs } from "@/lib/robi/responses";

describe("preambleDurationMs — dynamic content-preamble gap", () => {
  it("returns the duration from the catalog for each content kind", () => {
    // audios.json is the single source of truth — the backfill script
    // (sonidos/durations.mjs) populates `durationMs`. These values come
    // from afinfo measurements of the actual mp3s.
    const jokeDur = preambleDurationMs("joke");
    const riddleDur = preambleDurationMs("riddle");
    const factDur = preambleDurationMs("fact");
    expect(jokeDur).toBeGreaterThan(0);
    expect(riddleDur).toBeGreaterThan(0);
    expect(factDur).toBeGreaterThan(0);
  });

  it("values are within the typical preamble range (1-6 seconds)", () => {
    // Sanity bound: preambles are short fillers. If this fails, either
    // the audio generator produced something very different OR afinfo
    // is reading the wrong field. Don't blindly bump the bound.
    const jokeDur = preambleDurationMs("joke");
    expect(jokeDur).toBeGreaterThan(1_000);
    expect(jokeDur).toBeLessThan(6_000);
  });

  it("does not return the legacy fixed 1200ms (regression check)", () => {
    // The bug we fixed: PREAMBLE_TO_CONTENT_DELAY_MS = 1200 was hardcoded
    // and shorter than every actual preamble. Verify the helper now
    // returns real durations, not that magic number.
    expect(preambleDurationMs("joke")).not.toBe(1200);
    expect(preambleDurationMs("riddle")).not.toBe(1200);
    expect(preambleDurationMs("fact")).not.toBe(1200);
  });
});
