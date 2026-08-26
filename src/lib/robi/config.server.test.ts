import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_COMMAND_STEPS } from "./commands";

describe("server movement config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does not let a stale MAX_STEPS value truncate explicit movement", async () => {
    vi.stubEnv("MAX_STEPS", "5");
    vi.resetModules();

    const { SERVER_CONFIG } = await import("./config.server");

    expect(SERVER_CONFIG.maxSteps).toBe(MAX_COMMAND_STEPS);
    expect(SERVER_CONFIG.maxSteps).toBe(100);
  });
});
