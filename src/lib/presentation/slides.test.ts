import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { PRESENTATION_SLIDES } from "./slides";

describe("ROBI profession presentation manifest", () => {
  it("publishes the seven PDF pages in presentation order", () => {
    expect(PRESENTATION_SLIDES).toHaveLength(7);
    expect(PRESENTATION_SLIDES.map((slide) => slide.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    expect(PRESENTATION_SLIDES.map((slide) => slide.src)).toEqual(
      Array.from(
        { length: 7 },
        (_, index) => `/ppt/robi-profesion/slide-${String(index + 1).padStart(2, "0")}.webp`,
      ),
    );
  });

  it("provides a useful short title for every controller button", () => {
    for (const slide of PRESENTATION_SLIDES) {
      expect(slide.title.trim().length).toBeGreaterThan(3);
    }
  });

  it("redirects the seventh projector slide to the live ROBI display", () => {
    expect(PRESENTATION_SLIDES.slice(0, 6).every((slide) => !slide.redirectTo)).toBe(true);
    expect(PRESENTATION_SLIDES[6]?.redirectTo).toBe("/display");
  });

  it("keeps every optimized WebP slide in the public bundle", () => {
    for (const slide of PRESENTATION_SLIDES) {
      const file = new URL(`../../../public${slide.src}`, import.meta.url);
      const bytes = readFileSync(file);
      expect(statSync(file).size).toBeGreaterThan(10_000);
      expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
    }
  });
});
