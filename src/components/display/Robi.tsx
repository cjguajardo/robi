// Top-level ROBI scene for /display.
// Owns the WS connection, mirrors the server world into local state,
// triggers TTS playback and CSS animations.

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Direction,
  Position,
  RealtimeEvent,
  RobiCommand,
  RobiState,
  SessionSnapshot,
  StageItem as StageItemModel,
} from "@/types/robi";
import { BLOCK_PX, MS_PER_BLOCK } from "@/lib/robi/commands";
import { RobiAvatar } from "./RobiAvatar";
import { RobiSpeechBubble } from "./RobiSpeechBubble";
import { RobiStatus } from "./RobiStatus";
import { StageItem } from "./StageItem";
import {
  shouldRelayAudioLifecycle,
  type AudioLifecyclePurpose,
} from "./audio-lifecycle";
import { enterDisplayFullscreen } from "./fullscreen";

const WS_PATH = "/ws";

/**
 * Shortest valid silent WAV (~50 bytes). Used to "prime" the DOM-attached
 * <audio> element during a user gesture: the browser allows play() inside
 * a click handler only, so we play a silent buffer once and then every
 * subsequent `audio.play()` (triggered by WS SAY events) bypasses the
 * autoplay policy. Data URL keeps the unlock self-contained — no extra
 * asset to ship.
 */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRhYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

function buildWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}${WS_PATH}`;
}

export function Robi({ showStatus = false }: { showStatus?: boolean }) {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<RobiState>("SLEEPING");
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [direction, setDirection] = useState<Direction>("SOUTH");
  const [paused, setPaused] = useState(false);
  const [speech, setSpeech] = useState<string | null>(null);
  /** Most recent COMMAND broadcast — informs sprite track selection. */
  const [lastCommand, setLastCommand] = useState<RobiCommand | null>(null);
  const [stageItem, setStageItem] = useState<StageItemModel | null>(null);
  /**
   * Monotonic counter that increments every time a JUMP command is
   * observed. We pass this as a React `key` to RobiAvatar so the
   * `.avatar-wrap` re-mounts and the CSS jump animation re-runs on
   * back-to-back JUMPs.
   */
  const [jumpKey, setJumpKey] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioPurposeRef = useRef<AudioLifecyclePurpose>("idle");
  /** Tracks a blob URL we created from /api/tts so we can revoke it. */
  const blobUrlRef = useRef<string | null>(null);
  const speechTimer = useRef<number | null>(null);
  /**
   * Tracks whether the <audio> element has been "primed" via a user
   * gesture. False until the operator clicks the unlock button — every
   * browser autoplay policy (Chrome / Safari / Firefox) rejects
   * `audio.play()` with "user didn't interact" until then, and the
   * existing `.catch(() => {})` in playSay was swallowing the
   * rejection, which is why audios appeared to load but not play.
   */
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const handleEvent = (event: RealtimeEvent) => {
    switch (event.type) {
      case "SNAPSHOT": {
        const snap: SessionSnapshot = event.payload;
        setState(snap.state);
        setPosition(snap.position);
        setDirection(snap.direction);
        setPaused(snap.paused);
        setStageItem(snap.stageItem);
        if (snap.lastCommand) setLastCommand(snap.lastCommand);
        break;
      }
      case "STATE_CHANGED":
        setState(event.payload);
        break;
      case "WORLD_CHANGED": {
        // Position + direction arrived after a reducer EXECUTE. This is
        // what makes the avatar actually appear to move — STATE_CHANGED
        // alone never carried these, so without this case the kid would
        // press buttons and nothing on screen would change.
        const { position: newPos, direction: newDir } = event.payload;
        setPosition(newPos);
        setDirection(newDir);
        break;
      }
      case "COMMAND":
        // Remember the command so the avatar can pick the right sprite
        // strip when STATE_CHANGED → EXECUTING arrives (or already has).
        setLastCommand(event.payload);
        // Bump the jump key on every JUMP so the avatar-wrap remounts and
        // the CSS jump animation restarts (kid mashing the jump button).
        if (event.payload.type === "JUMP") {
          setJumpKey((k) => k + 1);
        }
        break;
      case "STAGE_ITEM_CHANGED":
        setStageItem(event.payload);
        break;
      case "SAY":
        // Speech bubble visible briefly while audio plays.
        setSpeech(event.payload.text);
        playSay(event.payload);
        if (speechTimer.current) window.clearTimeout(speechTimer.current);
        speechTimer.current = window.setTimeout(() => setSpeech(null), 6000);
        break;
      case "RESET":
        stopAudio();
        setState("SLEEPING");
        setPaused(false);
        setSpeech(null);
        setPosition({ x: 0, y: 0 });
        setDirection("SOUTH");
        setLastCommand(null);
        setStageItem(null);
        break;
      case "PAUSE":
        setPaused(true);
        stopAudio();
        break;
      case "RESUME":
        setPaused(false);
        break;
      case "TRANSCRIPT":
      case "ADD_STAGE_ITEM":
      case "PRESENTATION_GOTO":
      case "PRESENTATION_CHANGED":
      case "SPEECH_STARTED":
      case "SPEECH_ENDED":
        break;
    }
  };

  const connect = () => {
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
  };

  const scheduleReconnect = () => {
    if (reconnectTimer.current) return;
    reconnectTimer.current = window.setTimeout(() => {
      reconnectTimer.current = null;
      connect();
    }, 1500);
  };

  const stopAudio = () => {
    audioPurposeRef.current = "idle";
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  /**
   * Broadcast an audio-lifecycle event to the server so it can sync the
   * RobiState (THINKING ↔ SPEAKING) and unlock `drainQueue`'s
   * `waitForSpeechEnded`. The events exist in the wire format but were
   * never wired up — see `RealtimeEvent` in `@/types/robi`.
   *
   * Three triggers:
   *   - `play`  → SPEECH_STARTED. Drives sprite to SPEAKING (mouth moving).
   *   - `ended` → SPEECH_ENDED.   Drives sprite back to THINKING AND
   *                              unblocks the server's command-completion
   *                              wait — command proceeds to COMPLETE/IDLE.
   *   - `error` → SPEECH_ENDED.   Same as ended: error is also "audio is
   *                              done, even if it never played" so the
   *                              server doesn't hang on the safety timer.
   */
  const sendSpeechEvent = (type: "SPEECH_STARTED" | "SPEECH_ENDED") => {
    if (
      wsRef.current &&
      wsRef.current.readyState === WebSocket.OPEN
    ) {
      wsRef.current.send(JSON.stringify({ type }));
    }
  };

  /**
   * "Prime" the DOM-attached <audio> element inside a user gesture so
   * the browser's autoplay policy lets subsequent `audio.play()` calls
   * through. Without this, the first WS SAY after the page loads hits
   * the policy and `play()` rejects silently (the catch in playSay
   * intentionally swallows it). The /display page in a kiosk/proyector
   * setup has NO organic user interaction — kids press buttons on a
   * separate control device, not on the projector tab — so we provide
   * an explicit one-tap button instead of relying on first-gesture
   * detection.
   *
   * Pattern: set src to a tiny silent WAV (data URL — no extra asset
   * to ship), call play() inside the click handler, then reset src to
   * empty so the next real SAY can overwrite cleanly. The browser
   * remembers the element was started in a gesture and lifts the policy
   * for the lifetime of the page.
   */
  const unlockAudio = async () => {
    const audio = audioRef.current;
    if (!audio || audioUnlocked) return;
    audioPurposeRef.current = "unlock";
    audio.src = SILENT_WAV;

    // Both gated APIs must be invoked synchronously from this click.
    // Start audio first because requestFullscreen consumes the document's
    // transient user activation; await both only after both calls started.
    const audioPlay = audio.play();
    const fullscreenRequest = enterDisplayFullscreen(document);
    try {
      await audioPlay;
      audio.pause();
      audio.currentTime = 0;
      audio.src = "";
      setAudioUnlocked(true);
    } catch {
      // Shouldn't happen — this handler runs inside a click event. If
      // it does, leave audioUnlocked=false so the operator can retry.
      audio.src = "";
    } finally {
      audioPurposeRef.current = "idle";
    }

    // Fullscreen rejection is intentionally non-fatal: audio remains usable
    // and enterDisplayFullscreen already normalizes the failure to false.
    await fullscreenRequest;
  };

  /**
   * Play a SAY payload. Two paths:
   *   1. Pre-recorded (`payload.audioUrl` present) → straight to
   *      `<audio>.src = audioUrl`. Zero API calls, instant playback.
   *   2. Dynamic (LLM answer, RESET) → fall back to `/api/tts`.
   *      The server has an LRU cache so repeat strings stay free.
   */
  const playSay = async (payload: { text: string; audioUrl?: string }) => {
    stopAudio();
    // A direct (pre-recorded) audio file — no `/api/tts` hop.
    if (payload.audioUrl) {
      if (audioRef.current) {
        audioPurposeRef.current = "speech";
        audioRef.current.src = payload.audioUrl;
        await audioRef.current.play().catch(() => {
          // Autoplay blocked — see note in old `playTts`.
        });
      }
      return;
    }
    // No pre-recorded audio: ask the server's TTS to synthesise.
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payload.text }),
      });
      if (!res.ok) return; // Stay silent on failure — DESIGN.md §33.
      const blob = await res.blob();

      // Revoke the previous blob URL before allocating a new one —
      // prevents a slow memory leak on long-running displays.
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      // IMPORTANT: the <audio> element is rendered in the JSX below.
      // `new Audio(url)` returns a detached element that browsers refuse
      // to autoplay in most cases — that's the bug this fixes.
      if (audioRef.current) {
        audioPurposeRef.current = "speech";
        audioRef.current.src = url;
        await audioRef.current.play().catch(() => {
          // Autoplay may still be blocked if /display has never had user
          // interaction. The DOM-attached element is the prerequisite;
          // if we still land here we need a one-time "tap to enable".
        });
      }
    } catch {
      // Network failure — silent fallback.
    }
  };

  useEffect(() => {
    connect();
    // Wire up the audio element's lifecycle events so the server knows
    // when ROBI is actually talking vs silent. See `sendSpeechEvent`.
    const audio = audioRef.current;
    const onPlay = () => {
      if (shouldRelayAudioLifecycle(audioPurposeRef.current)) {
        sendSpeechEvent("SPEECH_STARTED");
      }
    };
    const finishSpeech = () => {
      if (!shouldRelayAudioLifecycle(audioPurposeRef.current)) return;
      audioPurposeRef.current = "idle";
      sendSpeechEvent("SPEECH_ENDED");
    };
    const onEnded = () => finishSpeech();
    const onError = () => finishSpeech();
    if (audio) {
      audio.addEventListener("play", onPlay);
      audio.addEventListener("ended", onEnded);
      audio.addEventListener("error", onError);
    }
    return () => {
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      if (speechTimer.current) window.clearTimeout(speechTimer.current);
      stopAudio();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      if (audio) {
        audio.removeEventListener("play", onPlay);
        audio.removeEventListener("ended", onEnded);
        audio.removeEventListener("error", onError);
      }
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

// Camera follow — avatar stays at the center of the scene while the
// world layers scroll behind it. Three parallax layers give depth
// (Mario / Sonic style):
//
//   - Sky   (far)   → 0.2× scroll speed — barely drifts, "infinite" distance
//   - Scene (mid)   → 0.5× scroll speed — drifts at half pace
//   - Floor (close) → 1.0× scroll speed — full speed, 1:1 with world blocks
//
// The visual ratio matters: sky should appear to move at 1/5 the
// speed of the floor. If we ever change BLOCK_PX, the parallax math
// still works because each layer multiplies by its own rate.
//
// CSS background-position increases DOWN and RIGHT. The world coordinate
// system increases RIGHT (east) and UP (north). So when ROBI moves east
// by N blocks, each layer's background has to scroll LEFT by
// N*BLOCK_PX*rate to make it look like the world is moving west relative
// to ROBI. Y axis: only the floor follows vertical movement — sky stays
// fixed (you don't see the horizon rise when you walk), and the scene
// drifts at half speed.
const transitionMs = useMemo<number>(() => {
    if (!lastCommand) return MS_PER_BLOCK;
    switch (lastCommand.type) {
      case "WALK_LEFT":
      case "WALK_RIGHT":
        return Math.max(400, lastCommand.steps * MS_PER_BLOCK);
      case "JUMP":
        // JUMP is always 1 block — no steps field on the variant.
        return Math.max(400, MS_PER_BLOCK);
      default:
        return MS_PER_BLOCK;
    }
  }, [lastCommand]);

  const skyStyle = useMemo<React.CSSProperties>(
    () => ({
      backgroundPosition: `${-position.x * BLOCK_PX * 0.2}px 0px`,
      transition: `background-position ${transitionMs}ms linear`,
    }),
    [position, transitionMs],
  );

  const sceneStyle = useMemo<React.CSSProperties>(
    () => ({
      backgroundPosition: `${-position.x * BLOCK_PX * 0.5}px ${-position.y * BLOCK_PX * 0.5}px`,
      transition: `background-position ${transitionMs}ms linear`,
    }),
    [position, transitionMs],
  );

  const floorStyle = useMemo<React.CSSProperties>(
    () => ({
      backgroundPosition: `${-position.x * BLOCK_PX}px ${position.y * BLOCK_PX}px`,
      transition: `background-position ${transitionMs}ms linear`,
    }),
    [position, transitionMs],
  );

  return (
    <div className="robi-scene" data-state={state.toLowerCase()} data-paused={paused}>
      {/* Three-layer parallax — drawn back-to-front so the browser's
          default stacking puts them in the right visual order without
          explicit z-index on the layers themselves (the avatar and
          speech bubble come after, so they sit on top). */}
      <div className="robi-sky"    style={skyStyle}    aria-hidden="true" />
      <div className="robi-scene-bg" style={sceneStyle} aria-hidden="true" />
      <div className="robi-floor"  style={floorStyle}  aria-hidden="true" />
      {stageItem && (
        <StageItem
          item={stageItem}
          robiPosition={position}
          transitionMs={transitionMs}
        />
      )}
      <RobiAvatar state={state} command={lastCommand} direction={direction} jumpKey={jumpKey} />
      <RobiSpeechBubble text={speech} state={state} />
      {showStatus && (
        <RobiStatus state={state} position={position} direction={direction} paused={paused} />
      )}
      <div className="conn" data-connected={connected}>
        {connected ? "🟢 conectado" : "🔴 sin conexión"}
      </div>
      {/* Audio unlock — persistent button (option C). The browser's
          autoplay policy rejects audio.play() until there's been a user
          gesture on this document; the /display page has none (kids
          press buttons on a separate control device), so we expose this
          as a one-tap manual unlock. Visual state reflects unlock so
          the operator knows audio is armed. Persistent (not hidden
          after click) so a refocused tab / context-restored session
          can re-prime without a page reload. */}
      <button
        type="button"
        className="audio-unlock"
        onClick={unlockAudio}
        aria-label={
          audioUnlocked
            ? "Audio activado"
            : "Activar audio y pantalla completa"
        }
        data-unlocked={audioUnlocked}
        disabled={audioUnlocked}
      >
        {audioUnlocked
          ? "🔊 Audio listo"
          : "🔊 Activar audio y pantalla completa"}
      </button>
      {/* Brand mark — top-center, subtle, doesn't compete with the
          avatar or the speech bubble. Hidden on very small viewports
          via .display-logo { display: none } in @media. */}
      <img src="/logo.webp" alt="" className="display-logo" width="242" height="128" aria-hidden="true" />
      {/* DOM-attached audio element. Required for autoplay — see playTts
          comment. No `controls` so it's invisible; `preload="auto"` so
          the browser fetches the metadata right after we set src. */}
      <audio ref={audioRef} preload="auto" />
    </div>
  );
}
