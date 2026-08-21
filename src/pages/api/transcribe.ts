// Speech-to-text endpoint.
// Accepts multipart/form-data with an "audio" file.
// Provider: OPENAI Whisper. If no key configured, returns a friendly error.
// See DESIGN.md §17, PRD §14.

import type { APIRoute } from "astro";
import { transcribeAudio } from "@/lib/speech/transcription";

export const POST: APIRoute = async ({ request }) => {
  try {
    const form = await request.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) {
      return Response.json(
        { error: { code: "BAD_REQUEST", message: "Missing audio file" } },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await transcribeAudio(buffer, file.name || "voice.webm", file.type);
    return Response.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[transcribe]", message);
    return Response.json(
      { error: { code: "TRANSCRIPTION_FAILED", message } },
      { status: 502 },
    );
  }
};
