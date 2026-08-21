# ROBI — Audio batch generator

This folder contains everything needed to generate the full ROBI audio library using OpenAI's `gpt-4o-mini-tts` model via the REST API.

## Why API, not browser

Earlier versions used Playwright to automate the OpenAI playground. Cloudflare's bot detection started blocking the automated browser with a "Checking your browser…" loop, so the script would hang at the login step forever. The REST API doesn't have that surface — it's just an authenticated HTTP endpoint. Same model, same voice, same `instructions` field, just no browser in the loop. The audio quality and per-phrase TTS instructions are identical.

## Files

```
sonidos/
├── audios.json     # All 56 phrases (text + TTS instructions) + config
├── generate.mjs    # API automation script
├── README.md       # This file
└── audios/         # Output folder (created automatically; MP3s land here)
```

## Setup (one time)

1. **Get an OpenAI API key** at https://platform.openai.com/api-keys (you need a paid account with TTS access — the free tier doesn't include audio generation).

2. **Put it in the project's `.env` file** (one level up from `sonidos/`). If you already have a key in there for the main server's TTS feature, you're done — the script reads from the same place. Otherwise add this line:

   ```env
   OPENAI_API_KEY=sk-proj-...your-key-here...
   ```

   The script reads the project's `.env` file directly — no need to `export` anything, no need to install anything. Node's built-in `fetch` (Node 18+) handles the HTTP.

   If you prefer env vars (CI, scheduled tasks), the script falls back to `process.env.OPENAI_API_KEY`:

   ```bash
   OPENAI_API_KEY=sk-... pnpm audios
   ```

## Run

From the project root:

```bash
pnpm audios
```

Or from the `sonidos/` folder:

```bash
cd sonidos
node generate.mjs
```

The script will:

1. Read `audios.json` (config + 56 phrases)
2. Read `OPENAI_API_KEY` from the environment
3. For each of the 56 phrases:
   - POST to `https://api.openai.com/v1/audio/speech` with the model, voice, input text, and combined instructions (global personality + per-phrase TTS shape)
   - Save the returned MP3 as `<filename>.mp3` in `sonidos/audios/`
   - Wait **60 seconds + a random 0–60s fraction** before the next phrase
4. Print a summary

Total runtime for 56 phrases: **~56–112 minutes** (depending on the random pause). The script catches per-phrase errors and continues, so one bad request doesn't kill the whole run.

## What the pause is for

The 60s+random pause keeps you well under OpenAI's rate limit for `gpt-4o-mini-tts` (which is generous for paid accounts, but the script's pace is also friendly to free-tier usage if you happen to be on one). If you run into rate-limit errors anyway, increase `MIN_PAUSE_MS` in `generate.mjs`.

## If something breaks

- **HTTP 401**: API key is wrong or expired. Generate a new one at https://platform.openai.com/api-keys and `export` it again.
- **HTTP 429**: rate-limited. Increase `MIN_PAUSE_MS` to 90s or 120s.
- **HTTP 400 with "model not found"**: the model name in `audios.json` doesn't match an active model. Check `config.model` — it should be `gpt-4o-mini-tts`.
- **HTTP 400 with "instructions not supported"**: instructions only work with `gpt-4o-mini-tts` and `gpt-4o-mini-tts-2025-03-20` etc. Older `tts-1` and `tts-1-hd` models ignore the field. If you change the model, the script will still send the instructions but the model will just ignore them.
- **Empty MP3 file**: usually a 200 response with `null` content (e.g. content policy block). The script logs the response status but the error message might be terse. Check the OpenAI dashboard for the request.

## Customizing

- **Change the output folder**: edit `OUTPUT_DIR` at the top of `generate.mjs`. Default is `sonidos/audios/`. To write directly into the project, change to `path.join(__dirname, '..', 'public', 'audio')`.
- **Change the pause range**: edit `MIN_PAUSE_MS` and `MAX_RANDOM_PAUSE_MS`. Default 60s + 0–60s.
- **Test with a few phrases first**: comment out the lines in `phrases[]` in `audios.json` you don't want to generate yet, or set `MIN_PAUSE_MS = 5000` for a quick dry-run.
- **Change voice / speed / format**: edit the `config` object at the top of `audios.json`. Voice options include `fable`, `echo`, `onyx`, `nova`, `shimmer`, `alloy`, `ash`, `sage`, `coral`, `ballad`. Format must be `MP3` (the only one supported by the API).
- **Edit a phrase**: just edit its entry in `audios.json` and re-run — the script will pick up the new text/instructions on the next run.

## Data sources

The 56 phrases come from:
- **scripts.md** (39 phrases): the TTS reference doc at the project root — action acknowledgments, error messages, preambles
- **src/lib/robi/responses.ts** (17 phrases): the JOKES, RIDDLES, FACTS arrays — the actual content that ROBI says during those interactions

If you add a phrase in `responses.ts` (e.g. a new joke) and want it in the audio library, add a corresponding entry to `audios.json` with the same filename pattern (`joke-08.mp3`, etc.).
