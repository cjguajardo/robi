// Transcription provider — currently OpenAI Whisper.
// Kept behind a small interface so a different provider can swap in.

export interface TranscriptionProvider {
  transcribe(args: {
    audio: Buffer;
    filename: string;
    mimeType: string;
  }): Promise<string>;
}

class OpenAIWhisper implements TranscriptionProvider {
  constructor(private apiKey: string) {}

  async transcribe({
    audio,
    filename,
    mimeType,
  }: {
    audio: Buffer;
    filename: string;
    mimeType: string;
  }): Promise<string> {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), filename);
    form.append("model", "whisper-1");
    form.append("language", "es");
    form.append("response_format", "json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Whisper failed (${res.status}): ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as { text?: string };
    return (data.text ?? "").trim();
  }
}

export function getProvider(): TranscriptionProvider | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAIWhisper(key);
}

export async function transcribeAudio(
  audio: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error("No STT provider configured (set OPENAI_API_KEY)");
  }
  return provider.transcribe({ audio, filename, mimeType });
}
