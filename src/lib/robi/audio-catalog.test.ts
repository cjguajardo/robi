import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetAudioCatalogForTesting,
  entriesFor,
  pick,
  tryPick,
  type AudioCategory,
} from "./audio-catalog";

describe("audio-catalog", () => {
  beforeEach(() => {
    _resetAudioCatalogForTesting();
  });

  describe("catalog loading", () => {
    it("loads entries for every category present in audios.json", () => {
      // Spot-check categories that surely exist (audios.json is the
      // canonical source — if this fails the JSON was mis-edited).
      const expected: AudioCategory[] = [
        "WALK_LEFT",
        "WALK_RIGHT",
        "JUMP",
        "GREET",
        "JOKE",
        "RIDDLE",
        "FACT",
        "SAY_GOODBYE",
        "PAUSED",
        "RESUMED",
        "COMPLETE",
        "ANSWER_QUESTION_FALLBACK",
        "ANSWER_QUESTION_PREAMBLE",
        "UNKNOWN",
      ];
      for (const c of expected) {
        expect(entriesFor(c).length, `category ${c}`).toBeGreaterThan(0);
      }
    });

    it("url points at /audio/{filename} for every entry", () => {
      const list = entriesFor("JUMP");
      for (const e of list) {
        expect(e.audioUrl).toBe(`/audio/${e.filename}`);
      }
    });
  });

  describe("empty-category contract (graceful degradation)", () => {
    it("entriesFor returns empty array (not throws) for an unknown category id", () => {
      // Cast through unknown to simulate a typo / future category that
      // audios.json doesn't yet carry. The catalog should never throw
      // on unknown — callers branch on .length === 0.
      const list = entriesFor("TOTALLY_FAKE_CATEGORY" as AudioCategory);
      expect(list).toEqual([]);
    });

    it("tryPick returns null for an unknown category id", () => {
      const entry = tryPick("TOTALLY_FAKE_CATEGORY" as AudioCategory);
      expect(entry).toBeNull();
    });

    it("pick THROWS for an unknown category (programming error)", () => {
      // Categories in the AudioCategory union should always have
      // audios — calling pick on an unknown one is a wiring bug that
      // we want loud, not silent.
      expect(() => pick("TOTALLY_FAKE_CATEGORY" as AudioCategory)).toThrow(
        /no entries for category/i,
      );
    });
  });

  describe("rotation (per-category counter, no consecutive repeats)", () => {
    it("cycles through JUMP without picking the same one twice", () => {
      const seen: string[] = [];
      for (let i = 0; i < 6; i++) seen.push(pick("JUMP").filename);
      // 6 picks with 2-entry catalog → pattern is A, B, A, B, A, B.
      // Adjacent elements must differ.
      for (let i = 1; i < seen.length; i++) {
        expect(seen[i], `idx ${i}`).not.toBe(seen[i - 1]);
      }
    });

    it("cycles through FACT without picking the same one twice", () => {
      const seen: string[] = [];
      for (let i = 0; i < 12; i++) seen.push(pick("FACT").filename);
      for (let i = 1; i < seen.length; i++) {
        expect(seen[i], `idx ${i}`).not.toBe(seen[i - 1]);
      }
    });

    it("is deterministic — same counter state yields same picks", () => {
      // Both calls share the (default fresh) module state, so pick #1
      // in each loop returns the same item.
      const a1 = pick("JOKE").filename;
      _resetAudioCatalogForTesting();
      const b1 = pick("JOKE").filename;
      expect(a1).toBe(b1);
    });

    it("per-category counters are independent", () => {
      // Burn through JUMP 5 times — GREET counter should still be at 0,
      // meaning its first pick is the catalog[0] entry.
      for (let i = 0; i < 5; i++) pick("JUMP");
      const firstGreet = pick("GREET").filename;
      _resetAudioCatalogForTesting();
      const expectedFirstGreet = pick("GREET").filename;
      expect(firstGreet).toBe(expectedFirstGreet);
    });

    it("single-entry category returns the same item every time", () => {
      // PAUSED has only one entry in audios.json — rotation collapses
      // to a no-op and that's fine (no choice to make).
      const all = Array.from({ length: 4 }, () => pick("PAUSED").filename);
      expect(new Set(all).size).toBe(1);
    });
  });
});
