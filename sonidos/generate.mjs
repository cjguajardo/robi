// ROBI audio batch generator — OpenAI TTS API direct (no browser).
//
// Why this version: Cloudflare was blocking the Playwright browser
// automation with bot-detection. The OpenAI REST API doesn't have that
// surface — it's just an authenticated HTTP endpoint. Same model, same
// voice, same instructions field, just no browser in the loop.
//
// Flow:
//   1. Read audios.json (config + 50 phrases with text and TTS instructions).
//   2. Read OPENAI_API_KEY from the environment.
//   3. For each phrase:
//      a. If MP3 already exists in sonidos/audios/ AND --force is NOT
//         passed → skip (no API call, no pause).
//      b. Otherwise POST to /v1/audio/speech and save the result.
//   4. Wait 60 seconds + a random 0–60s pause between phrases that WERE
//      generated (skips don't pay the pause either — no API call to
//      rate-limit around).
//
// Usage:
//   export OPENAI_API_KEY=sk-...
//   pnpm audios                   # skip existing, generate only missing
//   pnpm audios -- --force        # regenerate every phrase (e.g. after
//                                 # changing instructions in audios.json)
//   # or
//   node sonidos/generate.mjs [args]
//
// Get an API key at https://platform.openai.com/api-keys.
// The gpt-4o-mini-tts model supports the `instructions` field; older
// models (tts-1, tts-1-hd) ignore it, so don't change the model name
// unless you also rework the instructions logic.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'audios.json');
const OUTPUT_DIR = path.join(__dirname, 'audios');

// CLI flags. --force regenerates everything regardless of whether the
// MP3 already exists. Useful when you tweak the text or the per-phrase
// instructions in audios.json and want the new version.
const FORCE = process.argv.includes('--force');

/** True if the MP3 file already exists in the output dir. */
async function exists(filepath) {
  try {
    const s = await stat(filepath);
    return s.isFile();
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

// === Configuration ===

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';

// Pause between generations: 60s (minimum) + 0–60s random.
// Total per phrase: 60s to 120s. For 56 phrases, expect ~56–112 min.
const MIN_PAUSE_MS = 60_000;
const MAX_RANDOM_PAUSE_MS = 60_000;

// Per-phrase request timeout.
const REQUEST_TIMEOUT_MS = 60_000;

// === Helpers ===

function log(msg) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] ${msg}`);
}

function fmtSeconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

async function pause() {
  const randomMs = Math.floor(Math.random() * MAX_RANDOM_PAUSE_MS);
  const totalMs = MIN_PAUSE_MS + randomMs;
  log(`  ⏸  Pausing ${fmtSeconds(totalMs)} (60s + ${fmtSeconds(randomMs)} random)`);
  await new Promise(r => setTimeout(r, totalMs));
}

/** Build the full instructions string: global personality + per-phrase TTS shape. */
function buildInstructions(global, phrase) {
  const perPhrase = [
    `Tone: ${phrase.tone}`,
    `Rhythm: ${phrase.rhythm}`,
    `Emphasis: ${phrase.emphasis}`,
    `Pauses: ${phrase.pauses}`,
    `Details: ${phrase.details}`,
  ].join('\n');
  return `${global}\n\n${perPhrase}`;
}

/** Call the OpenAI TTS API. Returns a Buffer of MP3 bytes. */
async function generateSpeech({
  apiKey, model, voice, instructions, input, speed, responseFormat,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input,
        voice,
        instructions,
        speed,
        response_format: String(responseFormat).toLowerCase(),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status} — ${text.slice(0, 300)}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timer);
  }
}

// === .env parser ===

/**
 * Minimal .env parser. Returns a plain object of key→value. Handles:
 * - Lines starting with # (comments) and empty lines (skipped)
 * - Optional surrounding single or double quotes around the value
 * - Inline comments after unquoted values (`KEY=value # comment`)
 * Multi-line values and escaped quotes are NOT supported (not needed here).
 */
function parseEnv(content) {
  const env = {};
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let [, key, value] = match;
    // Strip surrounding quotes
    const quoted = value.match(/^(['"])(.*)\1$/);
    if (quoted) {
      value = quoted[2];
    } else {
      // Strip inline `# comment` for unquoted values only
      const commentIdx = value.indexOf(' #');
      if (commentIdx >= 0) value = value.slice(0, commentIdx).trimEnd();
    }
    env[key] = value;
  }
  return env;
}

/**
 * Resolve the OpenAI API key. Tries the project's .env file first (the
 * most common case — the user already has OPENAI_API_KEY there for the
 * main server), then falls back to the process environment for CI /
 * scheduled tasks. Returns null if neither has it.
 */
async function loadApiKey() {
  // 1. Try the project's .env (one level up from sonidos/)
  const envPath = path.join(__dirname, '..', '.env');
  try {
    const content = await readFile(envPath, 'utf-8');
    const env = parseEnv(content);
    if (env.OPENAI_API_KEY) {
      log(`  Loaded OPENAI_API_KEY from ${envPath}`);
      return env.OPENAI_API_KEY;
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      log(`  ⚠  Could not read ${envPath}: ${err.message}`);
    }
  }

  // 2. Fall back to process.env (for CI / scheduled tasks / inline export)
  if (process.env.OPENAI_API_KEY) {
    log('  Loaded OPENAI_API_KEY from environment');
    return process.env.OPENAI_API_KEY;
  }

  return null;
}

// === Main ===

async function main() {
  // Read API key. Prefers the project's .env file (where the user
  // already configures it for the main server), then falls back to
  // process.env. No interactive prompt because the script may run
  // unattended (cron, CI, etc.).
  const apiKey = await loadApiKey();
  if (!apiKey) {
    log('');
    log('FATAL: OPENAI_API_KEY not found.');
    log('');
    log('  Add it to the project .env file (one level up from sonidos/):');
    log('    OPENAI_API_KEY=sk-...');
    log('');
    log('  Or set it inline for one run:');
    log('    OPENAI_API_KEY=sk-... pnpm audios');
    log('');
    log('  Get a key at: https://platform.openai.com/api-keys');
    log('');
    process.exit(1);
  }

  log('📂 Loading config…');
  const config = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));
  log(`  ${config.phrases.length} phrases to generate`);
  log(`  Model: ${config.config.model}, Voice: ${config.config.voice}, Speed: ${config.config.speed}`);

  log('📁 Ensuring output dir…');
  await mkdir(OUTPUT_DIR, { recursive: true });

  log('');
  log('Starting generation loop…');
  log('');

  for (let i = 0; i < config.phrases.length; i++) {
    const phrase = config.phrases[i];
    const progress = `[${i + 1}/${config.phrases.length}]`;
    const outputPath = path.join(OUTPUT_DIR, phrase.filename);

    log(`${progress} 🎤 ${phrase.filename}`);
    log(`  Text: "${phrase.text.slice(0, 60)}${phrase.text.length > 60 ? '…' : ''}"`);

    // Skip if the MP3 is already on disk — don't pay API time + $$
    // for an audio we already have. Pass --force (or delete the file)
    // to regenerate a single phrase after editing its text/instructions.
    if (await exists(outputPath) && !FORCE) {
      log('  ⏭  Already exists, skipping (pass --force to regenerate)');
      log('');
      continue;
    }

    try {
      const fullInstructions = buildInstructions(config.globalInstructions, phrase);
      log('  Generating…');
      const t0 = Date.now();
      const audioBuffer = await generateSpeech({
        apiKey,
        model: config.config.model,
        input: phrase.text,
        voice: config.config.voice,
        instructions: fullInstructions,
        speed: config.config.speed,
        responseFormat: config.config.format,
      });
      log(`  Generated in ${fmtSeconds(Date.now() - t0)} (${audioBuffer.length} bytes)`);

      await writeFile(outputPath, audioBuffer);
      log(`  ✓ Saved: ${path.relative(__dirname, outputPath)}`);
    } catch (err) {
      log(`  ✗ FAILED: ${err.message.split('\n')[0]}`);
      log('  Continuing to next phrase…');
    }

    // Pause BEFORE the next iteration, only if we just spent an API
    // call. Skipped iterations fall through to `continue` above and
    // never reach this line — no pause paid for skipped phrases.
    if (i < config.phrases.length - 1) {
      await pause();
    }

    log('');
  }

  log('✅ All done!');
  log(`Output: ${OUTPUT_DIR}`);
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  console.error(err);
  process.exit(1);
});
