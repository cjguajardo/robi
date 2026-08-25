import { useCallback, useEffect, useRef, useState } from "react";
import type { PresentationState, RealtimeEvent } from "@/types/robi";
import { PRESENTATION_SLIDES } from "@/lib/presentation/slides";

const INITIAL_PRESENTATION: PresentationState = {
  currentSlide: 1,
  totalSlides: PRESENTATION_SLIDES.length,
};

function buildWsUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws`;
}

export function usePresentationSocket() {
  const [presentation, setPresentation] = useState(INITIAL_PRESENTATION);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: number | undefined;

    const connect = () => {
      if (disposed) return;
      const socket = new WebSocket(buildWsUrl());
      socketRef.current = socket;

      socket.onopen = () => setConnected(true);
      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as RealtimeEvent;
          if (event.type === "SNAPSHOT") {
            setPresentation(event.payload.presentation);
          } else if (event.type === "PRESENTATION_CHANGED") {
            setPresentation(event.payload);
          }
        } catch {
          // Ignore malformed peer traffic; the server remains authoritative.
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
        setConnected(false);
        if (!disposed) reconnectTimer = window.setTimeout(connect, 1500);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  const goTo = useCallback((slide: number): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(
      JSON.stringify({ type: "PRESENTATION_GOTO", payload: { slide } }),
    );
    return true;
  }, []);

  return { presentation, connected, goTo };
}
