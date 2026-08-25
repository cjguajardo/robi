import { describe, expect, it, vi } from "vitest";
import { enterDisplayFullscreen } from "./fullscreen";

describe("display fullscreen", () => {
  it("requests fullscreen with the browser navigation hidden", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const documentLike = {
      fullscreenElement: null,
      documentElement: { requestFullscreen },
    };

    await expect(enterDisplayFullscreen(documentLike)).resolves.toBe(true);
    expect(requestFullscreen).toHaveBeenCalledOnce();
    expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: "hide" });
  });

  it("does nothing when the display is already fullscreen", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const documentLike = {
      fullscreenElement: {},
      documentElement: { requestFullscreen },
    };

    await expect(enterDisplayFullscreen(documentLike)).resolves.toBe(true);
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it("fails silently when fullscreen is unavailable or rejected", async () => {
    await expect(
      enterDisplayFullscreen({
        fullscreenElement: null,
        documentElement: {},
      }),
    ).resolves.toBe(false);

    await expect(
      enterDisplayFullscreen({
        fullscreenElement: null,
        documentElement: {
          requestFullscreen: vi.fn().mockRejectedValue(new Error("blocked")),
        },
      }),
    ).resolves.toBe(false);
  });
});
