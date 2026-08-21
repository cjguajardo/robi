// Microphone button — captures audio, posts to /api/transcribe,
// then auto-pipes the transcript to /api/interpret + WS command bus.
// SVG icons, ripple on press, haptic feedback, three visual states.

import { useEffect, useRef, useState } from "react";
import { MicIcon, MicStopIcon, MicBusyIcon, CheckIcon } from "./Icons";

interface Props {
  onTranscript: (text: string) => void;
  onListeningChange: (listening: boolean) => void;
  disabled?: boolean;
}

function tap(ms = 12) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      // some browsers expose the API but throw on call; ignore.
    }
  }
}

/** State of the microphone permission at the OS/browser level. */
type MicPermission = "granted" | "denied" | "prompt" | "unsupported";

/**
 * Query the Permissions API for the current microphone state.
 *
 * Falls back to "unsupported" on browsers that throw or don't expose the
 * microphone query (older Safari iOS has historically done this — see
 * https://bugs.webkit.org). When unsupported, we just call getUserMedia
 * and let it surface whatever error happens.
 */
async function queryMicPermission(): Promise<MicPermission> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return "unsupported";
  }
  try {
    const result = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    if (result.state === "granted" || result.state === "denied" || result.state === "prompt") {
      return result.state;
    }
    return "prompt";
  } catch {
    return "unsupported";
  }
}

/**
 * Map a getUserMedia rejection to a kid-friendly Spanish message.
 * The browser surfaces specific DOMException names; we translate the
 * common ones and fall back to a generic catch-all.
 */
function micErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Error de audio. Inténtalo de nuevo.";
  switch (err.name) {
    case "NotAllowedError":
    case "SecurityError":
      // User denied the prompt OR the page is in an insecure context.
      return "Necesito permiso del micrófono para escucharte.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No encontré un micrófono en este dispositivo.";
    case "NotReadableError":
      return "El micrófono está en uso. Cierra otras aplicaciones e inténtalo de nuevo.";
    case "AbortError":
      return "Se canceló el inicio del micrófono.";
    default:
      return "Error de audio. Inténtalo de nuevo.";
  }
}

/** Spawn a ripple at click coordinates (matches the command-button feel). */
function spawnRipple(e: React.MouseEvent<HTMLButtonElement>) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement("span");
  const size = Math.max(rect.width, rect.height) * 1.2;
  ripple.className = "ripple";
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  ripple.addEventListener("animationend", () => ripple.remove());
}

export function MicrophoneButton({
  onTranscript,
  onListeningChange,
  disabled,
}: Props) {
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = () => {
    recRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    setListening(false);
    onListeningChange(false);
  };

  const start = async () => {
    setError(null);

    // Detect "explicitly denied" up front. If the user previously tapped
    // "Block" on the browser prompt, getUserMedia will silently refuse
    // (no re-prompt), so we have to surface a fix-it instruction instead
    // of spinning until the catch handler fires.
    const permState = await queryMicPermission();
    if (permState === "denied") {
      setError(
        "Permiso del micrófono bloqueado. Habilítalo desde el candado de la barra de direcciones."
      );
      tap(40);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      recRef.current = rec;
      chunksRef.current = [];
      setBusy(false);

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      rec.onstop = async () => {
        setBusy(true);
        try {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          const form = new FormData();
          form.append("audio", blob, "voice.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          if (!res.ok) {
            setError("No pude entender. Inténtalo de nuevo.");
            tap(40);
            return;
          }
          const data = (await res.json()) as { text?: string };
          if (data.text) {
            tap(20);
            setSent(true);
            window.setTimeout(() => setSent(false), 700);
            onTranscript(data.text);
          }
        } catch {
          setError("Error de red. Verificá tu conexión.");
          tap(40);
        } finally {
          setBusy(false);
        }
      };

      rec.start();
      setListening(true);
      onListeningChange(true);
      tap(15);
    } catch (err) {
      setError(micErrorMessage(err));
      console.error(err);
    }
  };

  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handle = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (busy) return;
    spawnRipple(e);
    if (listening) stop();
    else start();
  };

  const label = busy
    ? "Procesando…"
    : listening
      ? "Toca para enviar"
      : "Tocar para hablar";

  const Icon = busy ? MicBusyIcon : listening ? MicStopIcon : MicIcon;

  return (
    <div className="mic">
      <button
        type="button"
        className={`mic-btn ${listening ? "live" : ""} ${busy ? "busy" : ""} ${sent ? "sent" : ""}`}
        onClick={handle}
        disabled={disabled}
        aria-label={listening ? "Detener escucha" : "Iniciar escucha"}
      >
        <span className="ring" aria-hidden="true" />
        <span className="ic-wrap">
          <Icon size={42} />
          <CheckIcon size={20} className="sent-check" />
        </span>
        <span className="lb">{label}</span>
      </button>
      {error && <p className="mic-error" role="alert">{error}</p>}
    </div>
  );
}