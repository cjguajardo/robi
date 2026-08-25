import { beforeEach, describe, expect, it } from "vitest";
import { _resetForTesting, readSnapshot } from "./server";
import { handleIncoming } from "./ws";

describe("WebSocket controller authentication", () => {
  beforeEach(() => {
    _resetForTesting();
  });

  it("keeps an unauthenticated public peer read-only", () => {
    handleIncoming({ type: "PAUSE" }, false);

    expect(readSnapshot().paused).toBe(false);
  });

  it("accepts controller events from a peer with a valid session", () => {
    handleIncoming({ type: "PAUSE" }, true);

    expect(readSnapshot().paused).toBe(true);
  });

  it("continues to accept display audio lifecycle events without auth", () => {
    handleIncoming({ type: "SPEECH_ENDED" }, false);

    expect(readSnapshot().paused).toBe(false);
  });

  it("only accepts presentation navigation from an authenticated peer", () => {
    handleIncoming(
      { type: "PRESENTATION_GOTO", payload: { slide: 5 } },
      false,
    );
    expect(readSnapshot().presentation.currentSlide).toBe(1);

    handleIncoming(
      { type: "PRESENTATION_GOTO", payload: { slide: 5 } },
      true,
    );
    expect(readSnapshot().presentation.currentSlide).toBe(5);
  });
});
