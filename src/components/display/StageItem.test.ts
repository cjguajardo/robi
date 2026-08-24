import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StageItem } from "./StageItem";

const displayCss = readFileSync(
  new URL("../../styles/display.css", import.meta.url),
  "utf8",
);
const robiSource = readFileSync(new URL("./Robi.tsx", import.meta.url), "utf8");

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

    expect(html).toContain(
      'class="stage-item stage-item-ball stage-item-side stage-item-right"',
    );
    expect(html).toContain('aria-label="Pelota a la derecha, 7 pasos"');
    expect(html).toContain('<span class="stage-item-hint">7 pasos</span>');
    expect(html).toContain('--stage-item-x:320px');
    expect(html).toContain('--stage-item-transition:1750ms');
    expect(displayCss).toMatch(
      /\.stage-item-hint\s*{[^}]*top:\s*calc\(100% \+ 12px\)[^}]*left:\s*50%[^}]*transform:\s*translateX\(-50%\)/s,
    );
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
    expect(html).toContain('aria-label="Estrella arriba de ROBI"');
    expect(html).not.toContain("stage-item-hint");
  });

  it("centers the left-step hint below the target", () => {
    const html = renderToStaticMarkup(
      createElement(StageItem, {
        item: {
          kind: "BOX",
          placement: "LEFT",
          position: { x: -6, y: 0 },
          distanceSteps: 6,
        },
        robiPosition: { x: 0, y: 0 },
        transitionMs: 2100,
      }),
    );

    expect(html).toContain(
      'class="stage-item stage-item-box stage-item-side stage-item-left"',
    );
    expect(html).toContain('aria-label="Caja a la izquierda, 6 pasos"');
    expect(html).toContain('<span class="stage-item-hint">6 pasos</span>');
  });

  it("uses linear world motion so collision timing matches visual contact", () => {
    expect(displayCss).toMatch(
      /transition:\s*transform var\(--stage-item-transition\) linear/,
    );
    expect(robiSource.match(/background-position \$\{transitionMs\}ms linear/g)).toHaveLength(3);
    expect(robiSource).not.toMatch(/background-position \$\{transitionMs\}ms ease-in-out/);
  });
});
