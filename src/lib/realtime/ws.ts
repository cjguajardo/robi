// WebSocket server glue — attaches a WS server to an HTTP server.
// Designed to share a port with Astro's middleware handler.
// One world, one path: /ws. Bare RealtimeEvent over the wire (no envelope).

import { WebSocketServer, type WebSocket } from "ws";
import type { Server as HttpServer } from "node:http";
import {
  attachPeer,
  detachPeer,
  ingestCommand,
  ingestStageItemRequest,
  ingestWorldEvent,
  ingestSay,
  ingestSpeechEvent,
} from "@/lib/realtime/server";
import type { RealtimeEvent, RobiCommand } from "@/types/robi";
import { pausedResponseWithAudio, resumedResponseWithAudio } from "@/lib/robi/responses";
import {
  isControlCookieAuthenticated,
  isControlEventAllowed,
} from "@/lib/auth/control-auth";

const PATH = "/ws";

function send(ws: WebSocket, event: RealtimeEvent): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

export function attachWebSocket(server: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== PATH) {
      // Not our WS path — destroy the socket immediately. Otherwise the
      // peer's ECONNRESET bubbles up as an unhandled 'error' event and
      // crashes the whole process. (Node gives you ownership of the
      // socket the moment you register an 'upgrade' listener.)
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws: WebSocket, request) => {
    const authenticated = isControlCookieAuthenticated(request.headers.cookie);
    console.log(`[ws] connect (${authenticated ? "control" : "display/read-only"})`);

    const peer = {
      send: (event: RealtimeEvent) => send(ws, event),
    };
    attachPeer(peer);

    ws.on("message", (raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== "object") return;
      const obj = parsed as { type?: unknown };
      if (typeof obj.type !== "string") return;
      handleIncoming(obj as RealtimeEvent, authenticated);
    });

    ws.on("close", () => {
      console.log("[ws] close");
      detachPeer(peer);
    });

    ws.on("error", (err) => {
      console.error("[ws] error", err);
    });
  });
}

export function handleIncoming(
  event: RealtimeEvent,
  authenticated: boolean,
): void {
  if (!isControlEventAllowed(event.type, authenticated)) return;

  switch (event.type) {
    case "COMMAND": {
      const cmd: RobiCommand = event.payload;
      // ingestCommand validates + queues. The SAY broadcast happens
      // inside drainQueue (it knows the right moment — for ANSWER_QUESTION
      // we wait for the LLM first, for other commands we use the canned
      // response after a fixed delay). Single source of truth for SAY.
      ingestCommand(cmd);
      break;
    }
    case "ADD_STAGE_ITEM":
      ingestStageItemRequest(event.payload.placement);
      break;
    case "TRANSCRIPT":
      // Just store + broadcast — no execution yet (control view already shows it).
      ingestCommand({ type: "STOP" }, event.payload);
      break;
    case "RESET":
      ingestWorldEvent("RESET");
      // RESET has no pre-generated audio — plain text fallback to /api/tts.
      // The synthesise LRU will cache the Buffer after the first call so
      // subsequent resets in the same session are free.
      ingestSay({ text: "Vuelvo al inicio." });
      break;
    case "PAUSE":
      ingestWorldEvent("PAUSE");
      ingestSay(pausedResponseWithAudio());
      break;
    case "RESUME":
      ingestWorldEvent("RESUME");
      ingestSay(resumedResponseWithAudio());
      break;
    case "SNAPSHOT":
    case "STATE_CHANGED":
    case "SAY":
    case "WORLD_CHANGED":
    case "STAGE_ITEM_CHANGED":
      // Server-driven; ignore from client.
      break;
    case "SPEECH_STARTED":
    case "SPEECH_ENDED":
      // Client reports audio playback lifecycle:
      //   SPEECH_STARTED → <audio>.play fired (transitions state to SPEAKING)
      //   SPEECH_ENDED   → <audio>.ended / error fired (transition + resolves
      //     the drainQueue's `waitForSpeechEnded` so the command can COMPLETE
      //     based on reality, not a fixed estimate).
      ingestSpeechEvent(event.type);
      break;
  }
}
