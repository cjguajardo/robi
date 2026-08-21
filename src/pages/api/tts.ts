// TTS endpoint — turns text into audio bytes.
// Provider: OpenAI TTS. Returns audio/mpeg.
// See DESIGN.md §19, §20.

import type { APIRoute } from "astro";
import { synthesizeSpeech } from "@/lib/tts/synthesize";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as { text?: string };
    const raw = body?.text;
    // Defensive: only stringify-able inputs make it to the TTS provider.
    // Some callers (e.g. malformed middleware probes) have been seen
    // sending objects where a string is expected — fail loudly instead
    // of trying `.trim` on a non-string.
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) {
      return Response.json(
        { error: { code: "BAD_REQUEST", message: "Missing text" } },
        { status: 400 },
      );
    }
    const audio = await synthesizeSpeech(text);
    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[tts]", message);
    return Response.json(
      { error: { code: "TTS_FAILED", message } },
      { status: 502 },
    );
  }
};
