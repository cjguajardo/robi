import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RobiAvatar } from "./RobiAvatar";

const displayCss = readFileSync(
  new URL("../../styles/display.css", import.meta.url),
  "utf8",
);

describe("RobiAvatar JUMP", () => {
  it("applies one vertical jump animation to the element that owns the jumping class", () => {
    const html = renderToStaticMarkup(
      createElement(RobiAvatar, {
        state: "EXECUTING",
        command: { type: "JUMP" },
        jumpKey: 1,
      }),
    );

    expect(html).toContain('class="avatar-wrap jumping"');
    expect(displayCss).toMatch(
      /\.avatar-wrap\.jumping\s*{[^}]*animation:\s*avatar-jump\s+700ms[^;}]*;/s,
    );
    expect(displayCss).not.toContain(".avatar-scaler.jumping .avatar-wrap");
  });
});
