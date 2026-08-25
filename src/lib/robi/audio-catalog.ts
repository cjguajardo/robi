// Audio catalog — single source of truth for ROBI's pre-generated
// responses. Derived from `assets/sonidos/audios.json` so the rotation picks
// text + audio path that always match (no bubble-vs-audio drift).
//
// audios.json is the canonical source (it's the file the OpenAI batch
// generator reads — see assets/sonidos/README.md). We don't maintain a parallel
// hand-written TypeScript mirror, because that's two sources of truth
// that drift apart the moment someone adds a joke.
//
// Rotation strategy: per-category counter, `counter % length`. A
// monotonically incrementing counter guarantees consecutive calls
// land on different items whenever the category has ≥2 entries
// (consecutive indices differ by 1, so they only collide modulo N
// when N=1). Per-category counters keep busy categories from
// starving quiet ones.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export interface AudioEntry {
  /** File under /audio (no leading slash). Source: audios.json `filename`. */
  filename: string;
  /** Spanish text shown in the speech bubble AND said in the audio. */
  text: string;
  /** Resolved public URL — `/audio/${filename}`. */
  audioUrl: string;
  /**
   * Audio duration in milliseconds. Source: audios.json `durationMs`,
   * populated by `assets/sonidos/durations.mjs` (afinfo) on demand. Used by
   * the server to compute dynamic wait time between preamble and
   * content SAYs for TELL_JOKE/RIDDLE/FACT.
   *
   * Optional because audios.json might lack the field if the backfill
   * script hasn't been run yet; callers that need it fall back to a
   * safe default.
   */
  durationMs?: number;
}

/** Granular category — every audios.json entry maps 1:1 to one of these. */
export type AudioCategory =
  | "WALK_LEFT"
  | "WALK_RIGHT"
  | "JUMP"
  | "STOP"
  | "GREET"
  | "DANCE"
  | "CELEBRATE"
  | "TELL_JOKE_PREAMBLE"
  | "JOKE"
  | "TELL_RIDDLE_PREAMBLE"
  | "RIDDLE"
  | "TELL_FACT_PREAMBLE"
  | "FACT"
  | "ANSWER_QUESTION_PREAMBLE"
  | "SAY_GOODBYE"
  | "ANSWER_QUESTION_FALLBACK"
  | "UNKNOWN"
  | "BUG"
  | "PAUSED"
  | "RESUMED"
  | "COMPLETE";

interface PhraseJson {
  filename: string;
  category: AudioCategory;
  text: string;
  /** Optional — populated by `assets/sonidos/durations.mjs` from `afinfo`. */
  durationMs?: number;
}

interface CatalogJson {
  phrases: PhraseJson[];
}

let CACHE: Partial<Record<AudioCategory, AudioEntry[]>> | null = null;

/** Build the catalog once, then memoise. */
function buildCatalog(): Partial<Record<AudioCategory, AudioEntry[]>> {
  // Resolve audios.json relative to this module's source. Works in
  // `pnpm dev` (Astro/Vite) AND `pnpm start` (tsx resolves the same
  // way because the source path is preserved). Layout from this file:
  //   src/lib/robi/audio-catalog.ts → project_root/assets/sonidos/audios.json
  //   Three levels up: here is /<root>/src/lib/robi/.
  const here = dirname(fileURLToPath(import.meta.url));
  const projectRoot = join(here, "..", "..", "..");
  const jsonPath = join(projectRoot, "assets", "sonidos", "audios.json");

  const raw = readFileSync(jsonPath, "utf8");
  const parsed = JSON.parse(raw) as CatalogJson;

  const byCategory: Partial<Record<AudioCategory, AudioEntry[]>> = {};
  for (const phrase of parsed.phrases) {
    const entry: AudioEntry = {
      filename: phrase.filename,
      text: phrase.text,
      audioUrl: `/audio/${phrase.filename}`,
      // durationMs is optional in the JSON; the backfill script
      // (`assets/sonidos/durations.mjs`) populates it. Older audios.json
      // files without it will leave this undefined and the server
      // falls back to PREAMBLE_TO_CONTENT_DELAY_MS_DEFAULT.
      durationMs: phrase.durationMs,
    };
    (byCategory[phrase.category] ??= []).push(entry);
  }
  return byCategory;
}

function getCatalog(): Partial<Record<AudioCategory, AudioEntry[]>> {
  if (!CACHE) CACHE = buildCatalog();
  return CACHE;
}

/** Drop memoised state. Test-only. */
export function _resetAudioCatalogForTesting(): void {
  CACHE = null;
  counters = {};
}

/**
 * Direct access. Returns an empty array (NOT throws) if the category
 * has no entries — categories like `ANSWER_QUESTION_PREAMBLE` may be
 * declared in the type system before audios are generated for them.
 * Callers that require audio can use `tryPick` for a nullable pick.
 */
export function entriesFor(category: AudioCategory): readonly AudioEntry[] {
  return getCatalog()[category] ?? [];
}

// --- Rotation ---------------------------------------------------------

let counters: Partial<Record<AudioCategory, number>> = {};

/**
 * Pick the next entry for `category`. Throws if the category has no
 * entries — that's a programming error for a category that should
 * always have audio (e.g. JOKE without jokes wired up).
 */
export function pick(category: AudioCategory): AudioEntry {
  const list = entriesFor(category);
  if (list.length === 0) {
    throw new Error(
      `audio-catalog: no entries for category "${category}". ` +
        `Run "pnpm audios" to generate, or pick a different category.`,
    );
  }
  const idx = (counters[category] ?? 0) % list.length;
  counters[category] = (counters[category] ?? 0) + 1;
  return list[idx];
}

/**
 * Same as `pick` but returns `null` instead of throwing when the
 * catalog has no entries for `category`. Use this for optional
 * categories (e.g. preambles that may not have audios yet) — the
 * caller can branch on null instead of try/catch.
 */
export function tryPick(category: AudioCategory): AudioEntry | null {
  const list = entriesFor(category);
  if (list.length === 0) return null;
  const idx = (counters[category] ?? 0) % list.length;
  counters[category] = (counters[category] ?? 0) + 1;
  return list[idx];
}
