// TTS provider — OpenAI TTS by default.
// Default voice is `fable` (masculine, expressive, storytelling — the
// most "thin" of the male options; the rest of OpenAI's male voices
// `echo` is warm, `onyx` is deep/authoritative). Female options
// `nova` / `shimmer` are still available via TTS_VOICE if needed.
// An in-memory LRU cache keeps frequent phrases warm (DESIGN.md §21).

export interface TtsProvider {
  synthesize(text: string): Promise<Buffer>;
}

class OpenAITts implements TtsProvider {
  constructor(
    private apiKey: string,
    private voice = "fable",
  ) {}

  async synthesize(text: string): Promise<Buffer> {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: this.voice,
        input: text,
        format: "mp3",
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`TTS failed (${res.status}): ${detail.slice(0, 200)}`);
    }
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  }
}

export function getProvider(): TtsProvider | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const voice = process.env.TTS_VOICE ?? "fable";
  return new OpenAITts(key, voice);
}

/** Tiny LRU — bounded to keep memory predictable. */
const CACHE = new Map<string, Buffer>();
const MAX_CACHE = 32;

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const cached = CACHE.get(text);
  if (cached) return cached;

  const provider = getProvider();
  if (!provider) {
    throw new Error("No TTS provider configured (set OPENAI_API_KEY)");
  }
  const buf = await provider.synthesize(text);

  if (CACHE.size >= MAX_CACHE) {
    // Drop oldest insertion.
    const oldest = CACHE.keys().next().value;
    if (oldest !== undefined) CACHE.delete(oldest);
  }
  CACHE.set(text, buf);
  return buf;
}

/** Pre-warm the cache with the most frequent phrases.
 *  Call once at boot — see DESIGN.md §21. */
export async function warmCache(phrases: readonly string[]): Promise<void> {
  const provider = getProvider();
  if (!provider) return; // Without a provider there's nothing to warm.
  for (const phrase of phrases) {
    if (CACHE.has(phrase)) continue;
    try {
      const buf = await provider.synthesize(phrase);
      CACHE.set(phrase, buf);
      if (CACHE.size >= MAX_CACHE) break;
    } catch (err) {
      console.error("[tts] warmCache failed for phrase", err);
    }
  }
}
