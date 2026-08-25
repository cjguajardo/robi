import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PptController } from "./PptController";
import { PptDisplay, redirectToSlideDestination } from "./PptDisplay";
import { PRESENTATION_SLIDES } from "@/lib/presentation/slides";

describe("presentation pages", () => {
  it("renders the first slide as a projector-safe fullscreen surface", () => {
    const html = renderToStaticMarkup(createElement(PptDisplay));

    expect(html).toContain('class="ppt-display"');
    expect(html).toContain('/ppt/robi-profesion/slide-01.webp');
    expect(html).toContain('alt="Diapositiva 1: Conozcamos mi profesión"');
    expect(html).toContain("Pantalla completa");
    expect(html).toContain("1 / 7");
  });

  it("renders mobile previous, next, and direct slide controls", () => {
    const html = renderToStaticMarkup(createElement(PptController));

    expect(html).toContain("Control de presentación");
    expect(html).toContain('aria-label="Diapositiva anterior"');
    expect(html).toContain('aria-label="Diapositiva siguiente"');
    expect(html).toContain("1 de 7");
    expect(html.match(/class="ppt-slide-jump/g)).toHaveLength(7);
    expect(html).toContain('aria-current="page"');
  });

  it("redirects to ROBI only when the active slide has a destination", () => {
    const replace = vi.fn();

    expect(redirectToSlideDestination(PRESENTATION_SLIDES[0], replace)).toBe(false);
    expect(redirectToSlideDestination(PRESENTATION_SLIDES[6], replace)).toBe(true);
    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith("/display");
  });
});
