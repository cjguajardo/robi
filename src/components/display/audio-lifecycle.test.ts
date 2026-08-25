import { describe, expect, it } from "vitest";
import { shouldRelayAudioLifecycle } from "./audio-lifecycle";

describe("display audio lifecycle", () => {
  it("never reports the silent unlock sound as ROBI speech", () => {
    expect(shouldRelayAudioLifecycle("unlock")).toBe(false);
    expect(shouldRelayAudioLifecycle("idle")).toBe(false);
    expect(shouldRelayAudioLifecycle("speech")).toBe(true);
  });
});
