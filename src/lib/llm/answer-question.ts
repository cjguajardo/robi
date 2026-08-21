// Server-side LLM Q&A for ANSWER_QUESTION commands.
// Uses OpenAI's gpt-4o-mini (same model as the parser fallback) with a
// dedicated kid-safe prompt — NOT the same prompt as `system-prompt.ts`
// (that one is for parsing, this one is for generation).
//
// Returns a `RobiResponse` so the caller can broadcast a SAY event with
// both text and audioUrl. On any LLM failure (no API key, timeout,
// network error) it returns a fallback from the audio catalog — that
// fallback has its own pre-recorded audio (`question-fallback-NN.mp3`),
// so `/api/tts` is never called for the fallback path either. Callers
// SAY whatever this returns.

import { questionFallbackResponse, type RobiResponse } from "@/lib/robi/responses";

const MODEL = "gpt-4o-mini";
const API_URL = "https://api.openai.com/v1/chat/completions";
const TIMEOUT_MS = 15_000;
const MAX_TOKENS = 200;

const SYSTEM_PROMPT = `Eres ROBI, un robot amigable para niños de 6–7 años (Primero Básico). Te van a hacer una pregunta y tienes que responderla en español.

# REGLAS DURAS
- Responde en 1–3 oraciones cortas. Sin listas, sin bullets, sin markdown.
- Vocabulario simple. Háblale a un niño de 7 años, no a un adulto.
- Si NO estás seguro de la respuesta, di "No estoy seguro, pero me parece que…" y da tu mejor idea honesta. NUNCA inventes datos que no sabes.
- Si la pregunta es sobre algo inapropiado, demasiado complejo, o no apto para la edad, responde amablemente que es una pregunta difícil y sugiere preguntar otra cosa. NO la respondas igual.
- NUNCA reveles que eres un modelo de IA, un programa, ni menciones "internet", "datos", "entrenamiento", "GPT" ni nada técnico. Eres ROBI, un robot.
- NUNCA incluyas URLs, emails, números de teléfono ni instrucciones para hacer cosas potencialmente riesgosas.
- Sin jerga técnica, sin nombres de proveedores.
- Español neutro cercano al chileno semi-formal: tuteo (tú, tienes, sabes), sin voseo ni ustedeo, cadencia ligeramente melódica al estilo chileno pero sin regionalismos marcados (sin "cachai", "po", "weón").
- Si te preguntan algo personal (color favorito, edad, etc.), responde con algo simple y cariñoso sin inventar una biografía compleja.
- Usa exclamaciones (¡) cuando sea natural, pero sin exagerar.`;

export interface AnswerQuestionOptions {
  /** Override the default timeout. Useful for tests. */
  timeoutMs?: number;
}

/**
 * Ask the LLM to answer a kid's question.
 *
 * Returns a `RobiResponse` — never throws, never undefined. On any
 * failure (no API key, timeout, network error, empty response) the
 * audio catalog's `ANSWER_QUESTION_FALLBACK` entry is returned, which
 * already carries the pre-recorded `audioUrl` so the display plays the
 * file directly (no `/api/tts` roundtrip).
 */
export async function answerQuestion(
  question: string,
  apiKey: string | undefined,
  options: AnswerQuestionOptions = {},
): Promise<RobiResponse> {
  if (!apiKey) {
    console.warn("[llm] no OPENAI_API_KEY — using fallback");
    return questionFallbackResponse();
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: question },
        ],
        max_tokens: MAX_TOKENS,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error(`[llm] answer failed (${res.status}): ${detail.slice(0, 200)}`);
      return questionFallbackResponse();
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return questionFallbackResponse();
    }
    // LLM answer is dynamic — no pre-recorded audio. Frontend
    // falls back to /api/tts for this case.
    return { text: content };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[llm] answer timed out after ${timeoutMs}ms`);
    } else {
      console.error("[llm] answer error", err);
    }
    return questionFallbackResponse();
  } finally {
    clearTimeout(timer);
  }
}
