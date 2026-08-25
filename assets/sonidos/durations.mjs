// One-shot script: populate `durationMs` on every entry in
// `sonidos/audios.json` by reading each MP3 with macOS `afinfo`.
//
// Idempotent — re-running only fills entries that don't have a value
// (or overwrites stale ones if you pass `--force`).
//
// Doesn't touch OpenAI. Doesn't regenerate audio. Just reads existing
// files and writes their durations into the JSON.
//
// Usage:
//   pnpm audios:durations          # fill only missing durations
//   node sonidos/durations.mjs --force   # overwrite all durations
//
// Why this exists:
//   `sonidos/audios.json` is the single source of truth for the audio
//   catalog. Server needs per-audio duration to compute the gap between
//   preamble and content SAYs for TELL_JOKE/RIDDLE/FACT (see
//   references.md §5.1 Waiter pattern and server.ts drainQueue).
//
// Why not compute at runtime:
//   Re-reading MP3 metadata per SAY adds I/O on the request hot path.
//   Pre-populating the JSON keeps it cheap and the boot loading is
//   already a one-shot.

import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FORCE = process.argv.includes("--force");
const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");
const jsonPath = join(projectRoot, "sonidos", "audios.json");
const audioDir = join(projectRoot, "sonidos", "audios");

/**
 * Read an MP3's duration in milliseconds via macOS `afinfo`.
 * Output line we want: "estimated duration: 2.400000 sec".
 * Returns null if afinfo isn't available or the file is unreadable.
 */
function mp3DurationMs(filepath) {
  const r = spawnSync("afinfo", [filepath], { encoding: "utf8" });
  if (r.status !== 0) {
    console.warn(`  afinfo failed for ${filepath}: ${r.stderr.trim()}`);
    return null;
  }
  const m = r.stdout.match(/estimated duration:\s+([\d.]+)\s+sec/);
  if (!m) return null;
  return Math.round(Number(m[1]) * 1000);
}

const raw = JSON.parse(readFileSync(jsonPath, "utf8"));
const phrases = raw.phrases ?? [];

let updated = 0;
let skipped = 0;
let failed = 0;

for (const phrase of phrases) {
  if (!phrase.filename) continue;
  if (!FORCE && typeof phrase.durationMs === "number") {
    skipped++;
    continue;
  }
  const filepath = join(audioDir, phrase.filename);
  const ms = mp3DurationMs(filepath);
  if (ms === null) {
    failed++;
    console.warn(`⚠️  Could not read duration: ${phrase.filename}`);
    continue;
  }
  phrase.durationMs = ms;
  updated++;
}

writeFileSync(jsonPath, JSON.stringify(raw, null, 2) + "\n");

console.log(
  `Done. updated=${updated} skipped=${skipped} failed=${failed} total=${phrases.length}`,
);
if (failed > 0) {
  process.exit(1);
}
