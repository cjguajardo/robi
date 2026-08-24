import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ActivityLog, type ActivityItem } from "./ActivityLog";
import { CommandPanel } from "./CommandPanel";
import { Controller } from "./Controller";
import { StageItemControl } from "./StageItemControl";

const controlCss = readFileSync(
  new URL("../../styles/control.css", import.meta.url),
  "utf8",
);

const activity: ActivityItem[] = [
  {
    id: 1,
    transcript: null,
    command: { type: "GREET" },
    manual: true,
  },
];

describe("/control mobile initial state", () => {
  it("renders the compact 80px ROBI badge", () => {
    const html = renderToStaticMarkup(createElement(Controller));

    expect(html).toContain('class="badge badge-sleeping"');
    expect(html).toContain("width:80px");
    expect(html).not.toContain("width:132px");
    expect(html).toMatch(/checked="" value="5"/);
    expect(controlCss).toMatch(/\.badge-frame\s*{[^}]*border-radius:[^;}]+;[^}]*overflow:\s*hidden/s);
    expect(controlCss).toMatch(/\.badge-paused-overlay\s*{[^}]*border-radius:\s*inherit/s);
    expect(controlCss).toMatch(/\.badge-paused-overlay\s*{[^}]*place-content:\s*center/s);
  });

  it("renders the four directional controls in explicit spatial classes", () => {
    const html = renderToStaticMarkup(
      createElement(CommandPanel, {
        steps: 3,
        onStepsChange: vi.fn(),
        onCommand: vi.fn(),
      }),
    );

    expect(html.match(/class="dpad"/g)).toHaveLength(1);
    expect(html).toMatch(/class="pill dpad-up icon-only"[^>]*aria-label="Saltar"/);
    expect(html).toMatch(/class="pill dpad-left icon-only"[^>]*aria-label="Caminar a la izquierda"/);
    expect(html).toMatch(/class="pill dpad-right icon-only"[^>]*aria-label="Caminar a la derecha"/);
    expect(html).toMatch(/class="pill dpad-down icon-only"[^>]*aria-label="Detener"/);
    expect(html).toMatch(/class="movement-icon movement-icon-up"/);
    expect(html).toMatch(/class="movement-icon movement-icon-left"/);
    expect(html).toMatch(/class="movement-icon movement-icon-right"/);
    expect(html).toMatch(/class="movement-icon movement-icon-stop"/);
  });

  it("keeps the D-pad on a symmetric fixed 3x3 grid with visible keyboard focus", () => {
    expect(controlCss).toMatch(/\.dpad\s*{[^}]*grid-template-columns:\s*repeat\(3,\s*48px\)/s);
    expect(controlCss).toMatch(/\.dpad\s*{[^}]*grid-template-rows:\s*repeat\(3,\s*48px\)/s);
    expect(controlCss).toMatch(/\.dpad-up\s*{[^}]*grid-area:\s*1\s*\/\s*2/s);
    expect(controlCss).toMatch(/\.dpad-left\s*{[^}]*grid-area:\s*2\s*\/\s*1/s);
    expect(controlCss).toMatch(/\.dpad-right\s*{[^}]*grid-area:\s*2\s*\/\s*3/s);
    expect(controlCss).toMatch(/\.dpad-down\s*{[^}]*grid-area:\s*3\s*\/\s*2/s);
    expect(controlCss).toMatch(/\.pill:focus-visible\s*{[^}]*outline:/s);
  });

  it("groups all six quick actions into one accessible 3x2 block", () => {
    const html = renderToStaticMarkup(
      createElement(CommandPanel, {
        steps: 3,
        onStepsChange: vi.fn(),
        onCommand: vi.fn(),
      }),
    );

    expect(html.match(/class="quick-actions card"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Acciones y contenido"');
    for (const label of ["Saludar", "Bailar", "Celebrar", "Chiste", "Adivinanza", "Dato curioso"]) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    expect(html).not.toContain('class="section-title">Acciones</h2>');
    expect(html).not.toContain('class="section-title">Contenido</h2>');
    expect(controlCss).toMatch(/\.quick-actions\s*{[^}]*grid-template-columns:\s*repeat\(3,\s*1fr\)/s);
  });

  it("offers one-click random-object placement above, left, or right", () => {
    const html = renderToStaticMarkup(
      createElement(StageItemControl, {
        onAdd: vi.fn(),
      }),
    );

    expect(html).toContain('aria-label="Agregar un objeto al escenario"');
    expect(html).toContain("Objeto aleatorio");
    for (const label of [
      "Agregar objeto aleatorio a la izquierda",
      "Agregar objeto aleatorio arriba de ROBI",
      "Agregar objeto aleatorio a la derecha",
    ]) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    expect(controlCss).toMatch(/\.stage-item-control\s*{[^}]*grid-template-columns:/s);
    expect(controlCss).toMatch(/\.stage-position-button\s*{[^}]*min-height:\s*44px/s);
  });

  it("renders steps 1-10 as a keyboard-accessible keypad with 5 selected", () => {
    const html = renderToStaticMarkup(
      createElement(CommandPanel, {
        steps: 5,
        onStepsChange: vi.fn(),
        onCommand: vi.fn(),
      }),
    );

    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Cantidad de pasos"');
    expect(html.match(/type="radio"/g)).toHaveLength(10);
    expect(html).toMatch(/checked="" value="5"/);
    expect(html).toContain('value="10"');
    expect(controlCss).toMatch(/\.sg-root\s*{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(5,/s);
    expect(controlCss).toMatch(/\.sg-item-control\s*{[^}]*min-width:\s*32px[^}]*height:\s*44px/s);
    expect(controlCss).toMatch(/\.sg-item-control\[data-state="checked"\]\s*{[^}]*background:/s);
    expect(controlCss).toMatch(/\.sg-item-control\[data-focus-visible\]\s*{[^}]*outline:/s);
  });

  it("keeps emergency controls visible and history collapsed behind an accessible toggle", () => {
    const html = renderToStaticMarkup(
      createElement(ActivityLog, {
        items: activity,
        paused: false,
        onPause: vi.fn(),
        onResume: vi.fn(),
        onReset: vi.fn(),
      }),
    );

    expect(html).toContain(">Detener<");
    expect(html).toContain(">Reiniciar<");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="activity-history"');
    expect(html).toContain('id="activity-history"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("Historial (1)");
  });
});
