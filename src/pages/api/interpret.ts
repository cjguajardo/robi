// Interpret endpoint — converts transcript to a RobiCommand.
// Level 1: local parser. Level 2 (optional): LLM fallback.
// See DESIGN.md §10, §18.

import type { APIRoute } from "astro";
import { parseCommand } from "@/lib/robi/parser";
import { validateCommand } from "@/lib/robi/validator";
import { SERVER_CONFIG } from "@/lib/robi/config.server";
import { ROBI_SYSTEM_PROMPT } from "@/lib/llm/system-prompt";
import { getProvider as getSttProvider } from "@/lib/speech/transcription";
import type { RobiCommand } from "@/types/robi";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) {
      return Response.json({ command: { type: "UNKNOWN", raw: "" }, source: "rules" });
    }

    // Level 1 — local rules.
    const local = parseCommand(text, { defaultSteps: SERVER_CONFIG.defaultSteps });
    if (local.type !== "UNKNOWN") {
      return Response.json({ command: local, source: "rules" });
    }

    // Level 2 — LLM fallback (opt-in).
    if (SERVER_CONFIG.llmFallbackEnabled) {
      const llm = await interpretWithLlm(text);
      const validated = validateCommand(llm, SERVER_CONFIG);
      if (validated.ok) {
        return Response.json({ command: validated.command, source: "model" });
      }
    }

    // Stays UNKNOWN — the client can choose to send STOP or do nothing.
    return Response.json({ command: local, source: "rules" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[interpret]", message);
    return Response.json(
      { error: { code: "INTERPRET_FAILED", message } },
      { status: 500 },
    );
  }
};

async function interpretWithLlm(text: string): Promise<unknown> {
  // LLM fallback is intentionally narrow: the model is asked to output a JSON
  // command — never free-form code. Per DESIGN.md §8. Prompt lives in
  // src/lib/llm/system-prompt.ts so it can evolve without touching this route.
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("No LLM key configured");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: ROBI_SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`LLM failed (${res.status})`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(content) as RobiCommand;
}

// Re-export the STT provider lookup to keep the import surface tiny in callers.
export { getSttProvider };
