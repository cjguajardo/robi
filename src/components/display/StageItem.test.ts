import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StageItem } from "./StageItem";

describe("StageItem", () => {
  it("renders the selected object at its world offset from ROBI", () => {
    const html = renderToStaticMarkup(
      createElement(StageItem, {
        item: {
          kind: "BALL",
          placement: "RIGHT",
          position: { x: 7, y: 0 },
          distanceSteps: 7,
        },
        robiPosition: { x: 2, y: 0 },
        transitionMs: 1750,
      }),
    );

    expect(html).toContain('class="stage-item stage-item-ball stage-item-side"');
    expect(html).toContain('aria-label="Pelota"');
    expect(html).toContain('--stage-item-x:320px');
    expect(html).toContain('--stage-item-transition:1750ms');
  });

  it("renders an above target with its own vertical anchor", () => {
    const html = renderToStaticMarkup(
      createElement(StageItem, {
        item: {
          kind: "STAR",
          placement: "ABOVE",
          position: { x: 0, y: 1 },
          distanceSteps: 0,
        },
        robiPosition: { x: 0, y: 0 },
        transitionMs: 700,
      }),
    );

    expect(html).toContain('class="stage-item stage-item-star stage-item-above"');
    expect(html).toContain('aria-label="Estrella"');
  });
});
