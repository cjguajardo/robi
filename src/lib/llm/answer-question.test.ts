import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { answerQuestion } from "./answer-question";
import { QUESTION_FALLBACK } from "@/lib/robi/responses";
import { _resetAudioCatalogForTesting } from "@/lib/robi/audio-catalog";

describe("answerQuestion", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Reset the rotation so test order doesn't affect the picked entry.
    _resetAudioCatalogForTesting();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns the fallback when no API key is configured", async () => {
    const result = await answerQuestion("que es un robot", undefined);
    expect(result.text).toBe(QUESTION_FALLBACK);
    // Fallback path has a pre-recorded audio — that's the whole point
    // of routing through the audio catalog.
    expect(result.audioUrl).toMatch(/^\/audio\/question-fallback-\d+\.mp3$/);
  });

  it("returns the fallback on empty API key string", async () => {
    const result = await answerQuestion("que es un robot", "");
    expect(result.text).toBe(QUESTION_FALLBACK);
  });

  it("returns the model's content on a successful response", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "  Un robot es una máquina.  " } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const result = await answerQuestion("que es un robot", "sk-test");
    // LLM answers are dynamic — no pre-recorded audio.
    expect(result.text).toBe("Un robot es una máquina.");
    expect(result.audioUrl).toBeUndefined();
  });

  it("returns the fallback when the API responds with an error status", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("rate limited", { status: 429 }),
    ) as unknown as typeof fetch;

    const result = await answerQuestion("que es un robot", "sk-test");
    expect(result.text).toBe(QUESTION_FALLBACK);
    expect(result.audioUrl).toMatch(/^\/audio\/question-fallback-\d+\.mp3$/);
  });

  it("returns the fallback when the response has no content", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: {} }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    const result = await answerQuestion("que es un robot", "sk-test");
    expect(result.text).toBe(QUESTION_FALLBACK);
  });

  it("returns the fallback when the network call throws", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const result = await answerQuestion("que es un robot", "sk-test");
    expect(result.text).toBe(QUESTION_FALLBACK);
  });

  it("sends the question as a user message and includes the system prompt", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock;

    await answerQuestion("que es un robot", "sk-test");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("chat/completions");
    const body = JSON.parse(init.body as string);
    expect(body.messages).toEqual([
      expect.objectContaining({ role: "system", content: expect.any(String) }),
      { role: "user", content: "que es un robot" },
    ]);
    expect(body.messages[0].content).toMatch(/niños/i); // system prompt mentions kids
  });
});