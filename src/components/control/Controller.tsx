// Top-level controller for /control.
// iOS-style: flat header, big section titles, glass cards.

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeEvent, RobiCommand, RobiState, SessionSnapshot, StageItemPlacement } from "@/types/robi";
import { MicrophoneButton } from "./MicrophoneButton";
import { CommandPanel } from "./CommandPanel";
import { RobiStateBadge } from "./RobiStateBadge";
import { ActivityLog, type ActivityItem } from "./ActivityLog";
import { ToastViewport, pushToast } from "./Toast";
import { SunIcon } from "./Icons";
import { spawnRipple } from "./ripple";
import { StageItemControl } from "./StageItemControl";

const WS_PATH = "/ws";
const MAX_ACTIVITY = 4;

const STATE_LABEL: Record<RobiState, string> = {
  SLEEPING: "ROBI está dormido",
  IDLE: "En espera",
  LISTENING: "Escuchando",
  THINKING: "Pensando",
  SPEAKING: "Hablando",
  EXECUTING: "Ejecutando",
  CONFUSED: "No entendió",
  CELEBRATING: "Celebrando",
  PAUSED: "En pausa",
};

function buildWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}${WS_PATH}`;
}

/* Inline mini-robi icon for the connection row */
function MiniRobi({ badge }: { badge?: boolean }) {
  return (
    <span className="conn-icon-wrap">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <rect x="4" y="6" width="16" height="14" rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <line x1="12" y1="3" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="9" cy="13" r="1.5" fill="currentColor" />
        <circle cx="15" cy="13" r="1.5" fill="currentColor" />
      </svg>
      {badge && <span className="conn-dot" aria-hidden="true">×</span>}
    </span>
  );
}

export function Controller() {
  const [connected, setConnected] = useState(false);
  const [robiState, setRobiState] = useState<RobiState>("SLEEPING");
  const [paused, setPaused] = useState(false);
  const [steps, setSteps] = useState(3);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const activityIdRef = useRef(0);

  const pushActivity = useCallback((item: Omit<ActivityItem, "id">) => {
    activityIdRef.current += 1;
    setActivity((prev) => {
      const next = [{ ...item, id: activityIdRef.current }, ...prev];
      return next.slice(0, MAX_ACTIVITY);
    });
  }, []);

  const send = useCallback((event: RealtimeEvent): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== ws.OPEN) return false;
    ws.send(JSON.stringify(event));
    return true;
  }, []);

  const handleEvent = useCallback((event: RealtimeEvent) => {
    switch (event.type) {
      case "SNAPSHOT": {
        const snap: SessionSnapshot = event.payload;
        setRobiState(snap.state);
        setPaused(snap.paused);
        break;
      }
      case "STATE_CHANGED":
        setRobiState(event.payload);
        break;
      case "TRANSCRIPT":
        break;
      case "PAUSE":
        setPaused(true);
        break;
      case "RESUME":
        setPaused(false);
        break;
      case "RESET":
        setRobiState("IDLE");
        break;
      case "SAY":
      case "COMMAND":
      case "WORLD_CHANGED":
      case "ADD_STAGE_ITEM":
      case "STAGE_ITEM_CHANGED":
      case "SPEECH_STARTED":
      case "SPEECH_ENDED":
        break;
    }
  }, []);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(buildWsUrl());
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        scheduleReconnect();
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data);
          if (parsed && typeof parsed.type === "string") handleEvent(parsed as RealtimeEvent);
        } catch {
          // ignore malformed
        }
      };
    } catch {
      scheduleReconnect();
    }
  }, [handleEvent]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer.current) return;
    reconnectTimer.current = window.setTimeout(() => {
      reconnectTimer.current = null;
      connect();
    }, 1500);
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const onManual = useCallback(
    (cmd: RobiCommand) => {
      if (!send({ type: "COMMAND", payload: cmd })) {
        pushToast({ title: "Pantalla desconectada", type: "error" });
        return;
      }
      pushActivity({ transcript: null, command: cmd, manual: true });
    },
    [send, pushActivity],
  );

  const onTranscript = useCallback(
    async (text: string) => {
      try {
        const res = await fetch("/api/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          command?: RobiCommand;
          source?: string;
        };
        if (data.command) {
          pushActivity({ transcript: text, command: data.command, manual: false });
          send({ type: "COMMAND", payload: data.command });
        }
      } catch {
        pushToast({ title: "No pude interpretar el audio", type: "error" });
      }
    },
    [send, pushActivity],
  );

  const onWake = useCallback(() => {
    onManual({ type: "GREET" });
  }, [onManual]);

  const onAddStageItem = useCallback(
    (placement: StageItemPlacement) => {
      if (!send({ type: "ADD_STAGE_ITEM", payload: { placement } })) {
        pushToast({ title: "Pantalla desconectada", type: "error" });
        return;
      }
      pushToast({ title: "Objeto agregado al escenario" });
    },
    [send],
  );

  const stateLabel = paused ? "En pausa" : STATE_LABEL[robiState];
  const isSleeping = !paused && robiState === "SLEEPING";

  return (
    <div className="controller">
      {/* Header — brand logo (public/logo.webp) */}
      <header className="hdr">
        <img src="/logo.webp" alt="ROBI" className="brand-logo" width="242" height="128" />
      </header>

      {/* Connection row — small icon + status + notification badge */}
      <div className="conn-row" data-connected={connected}>
        <MiniRobi badge={!connected} />
        <span className="conn-text">{connected ? "Pantalla conectada" : "Pantalla desconectada"}</span>
      </div>

      {/* Hero card — face + state + wake/mic */}
      <section className="control-hero card">
        <RobiStateBadge state={paused ? "PAUSED" : robiState} size={80} />
        <div className="hero-state">{stateLabel}</div>
        {isSleeping ? (
          <>
            <button
              type="button"
              className="wake-btn"
              onClick={(e) => {
                spawnRipple(e);
                onWake();
              }}
              disabled={!connected}
            >
              <SunIcon size={20} />
              <span>Despertar a ROBI</span>
            </button>
            <p className="hero-hint">Toca el botón para empezar la actividad.</p>
          </>
        ) : (
          <>
            <MicrophoneButton
              onTranscript={onTranscript}
              onListeningChange={() => {}}
              disabled={paused || !connected}
            />
            <p className="hero-hint">O usa los botones de abajo si la voz falla.</p>
          </>
        )}
      </section>

      {/* Movimiento + Acciones */}
      <CommandPanel
        steps={steps}
        onStepsChange={setSteps}
        onCommand={onManual}
        disabled={!connected || paused}
      />

      <StageItemControl onAdd={onAddStageItem} disabled={!connected} />

      {/* Actividad (with embedded Detener / Reiniciar) */}
      <ActivityLog
        items={activity}
        paused={paused}
        onPause={() => send({ type: "PAUSE" })}
        onResume={() => send({ type: "RESUME" })}
        onReset={() => {
          send({ type: "RESET" });
          setActivity([]);
        }}
      />

      <ToastViewport />
    </div>
  );
}
