// Activity log — rolling list + emergency controls in one card.
// Detener / Reiniciar always visible at the top (critical controls).
// History list below is collapsible (closed by default on mobile) to
// keep the page fitting in one screen.

import { useState } from "react";
import type { RobiCommand } from "@/types/robi";
import { COMMAND_LABEL } from "@/lib/robi/commands";
import { MicIcon, HandIcon, PauseIcon, RefreshIcon, ChevronIcon } from "./Icons";
import { spawnRipple } from "./ripple";

export interface ActivityItem {
  id: number;
  /** Raw transcript if the command came from voice. */
  transcript: string | null;
  command: RobiCommand;
  /** True when the command was triggered by a manual button (no transcript). */
  manual: boolean;
}

interface Props {
  items: ActivityItem[];
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  paused: boolean;
}

// Single source of truth for command labels lives in @/lib/robi/commands.
// We only override UNKNOWN here because the activity log shows it compact
// ("?"), while the global COMMAND_LABEL uses the full "Desconocido".
const TYPE_LABEL: Record<RobiCommand["type"], string> = {
  ...COMMAND_LABEL,
  UNKNOWN: "?",
};

export function describe(cmd: RobiCommand): string {
  if (cmd.type === "WALK_LEFT" || cmd.type === "WALK_RIGHT") {
    return `${TYPE_LABEL[cmd.type]} ${cmd.steps}`;
  }
  return TYPE_LABEL[cmd.type];
}

export function ActivityLog({ items, onPause, onResume, onReset, paused }: Props) {
  // Closed by default — saves vertical space on phone viewports.
  // Controlled (not <details>) so we can animate max-height cleanly.
  const [open, setOpen] = useState(false);

  return (
    <div className="cmd-stack">
      <h2 className="section-title">Actividad</h2>
      <section className="card activity-card">
        {/* Emergency controls — always visible, top of the card. */}
        <div className="emergency-inline">
          {paused ? (
            <button
              type="button"
              className="pill ebtn resume"
              onClick={(e) => {
                spawnRipple(e);
                onResume();
              }}
            >
              <PauseIcon size={16} />
              <span>Reanudar</span>
            </button>
          ) : (
            <button
              type="button"
              className="pill ebtn stop"
              onClick={(e) => {
                spawnRipple(e);
                onPause();
              }}
            >
              <PauseIcon size={16} />
              <span>Detener</span>
            </button>
          )}
          <button
            type="button"
            className="pill ebtn reset"
            onClick={(e) => {
              spawnRipple(e);
              onReset();
              flashSent(e.currentTarget);
            }}
          >
            <RefreshIcon size={16} />
            <span>Reiniciar</span>
          </button>
        </div>

        {/* History — collapsible. Default closed so the page fits on
            a phone screen without scrolling. The toggle shows the
            current count so the operator knows there's content behind
            it. */}
        <button
          type="button"
          className="history-toggle"
          aria-expanded={open}
          aria-controls="activity-history"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="ht-label">
            Historial{items.length > 0 ? ` (${items.length})` : ""}
          </span>
          <ChevronIcon size={16} className={`ht-chevron ${open ? "open" : ""}`} />
        </button>

        <div
          id="activity-history"
          className={`history-wrap ${open ? "open" : ""}`}
          aria-hidden={!open}
        >
          {items.length === 0 ? (
            <p className="empty">Sin actividad todavía.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id} className={item.manual ? "manual" : "voice"}>
                  <span className="src" aria-label={item.manual ? "manual" : "voz"}>
                    {item.manual ? <HandIcon size={14} /> : <MicIcon size={14} />}
                  </span>
                  <span className="t">{item.transcript ?? describe(item.command)}</span>
                  <span className="c mono">{describe(item.command)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function flashSent(btn: HTMLButtonElement) {
  btn.setAttribute("data-sent", "");
  window.setTimeout(() => btn.removeAttribute("data-sent"), 600);
}
