import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { PRESENTATION_SLIDES } from "./slides";

describe("ROBI profession presentation manifest", () => {
  it("publishes the nine presentation pages in order", () => {
    expect(PRESENTATION_SLIDES).toHaveLength(9);
    expect(PRESENTATION_SLIDES.map((slide) => slide.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(PRESENTATION_SLIDES.map((slide) => slide.src)).toEqual(
      Array.from(
        { length: 9 },
        (_, index) => `/ppt/robi-profesion2/slide-${String(index + 1).padStart(2, "0")}.webp`,
      ),
    );
  });

  it("provides a useful short title for every controller button", () => {
    for (const slide of PRESENTATION_SLIDES) {
      expect(slide.title.trim().length).toBeGreaterThan(3);
    }
  });

  it("keeps the ROBI introduction visible and redirects only from slide nine", () => {
    expect(PRESENTATION_SLIDES.slice(0, 8).every((slide) => !slide.redirectTo)).toBe(true);
    expect(PRESENTATION_SLIDES[8]?.redirectTo).toBe("/display");
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

  it("keeps robi-profesion2 as the only published presentation version", () => {
    const legacyDeck = new URL("../../../public/ppt/robi-profesion", import.meta.url);

    expect(existsSync(legacyDeck)).toBe(false);
  });
});
