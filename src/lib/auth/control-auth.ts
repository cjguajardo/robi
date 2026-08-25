import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const CONTROL_SESSION_COOKIE = "robi_control_session";
export const CONTROL_SESSION_TTL_SECONDS = 24 * 60 * 60;

const CONTROL_EVENT_TYPES = new Set([
  "COMMAND",
  "ADD_STAGE_ITEM",
  "TRANSCRIPT",
  "RESET",
  "PAUSE",
  "RESUME",
  "PRESENTATION_GOTO",
]);

const DISPLAY_EVENT_TYPES = new Set(["SPEECH_STARTED", "SPEECH_ENDED"]);

export type ControlAccessPolicy = "page" | "api" | null;

export function getControlPassword(): string | undefined {
  const password = process.env.CONTROL_PASSWORD;
  return password && password.length > 0 ? password : undefined;
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function verifyControlPassword(
  candidate: string,
  configuredPassword = getControlPassword(),
): boolean {
  if (!configuredPassword) return false;
  return timingSafeEqual(digest(candidate), digest(configuredPassword));
}

function sign(payload: string, password: string): string {
  return createHmac("sha256", password).update(payload).digest("base64url");
}

export function createControlSession(
  password = getControlPassword(),
  now = Date.now(),
): string {
  if (!password) {
    throw new Error("CONTROL_PASSWORD is not configured");
  }
  const payload = Math.floor(now).toString(36);
  return `${payload}.${sign(payload, password)}`;
}

export function verifyControlSession(
  token: string | undefined,
  password = getControlPassword(),
  now = Date.now(),
): boolean {
  if (!token || !password) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, suppliedSignature] = parts;
  if (!payload || !suppliedSignature) return false;

  const issuedAt = Number.parseInt(payload, 36);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now) return false;
  if (now - issuedAt >= CONTROL_SESSION_TTL_SECONDS * 1_000) return false;

  const expectedSignature = sign(payload, password);
  return timingSafeEqual(digest(suppliedSignature), digest(expectedSignature));
}

export function readCookie(
  cookieHeader: string | null | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator === -1) continue;
    const key = item.slice(0, separator).trim();
    if (key !== name) continue;
    const value = item.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function isControlCookieAuthenticated(
  cookieHeader: string | null | undefined,
  password = getControlPassword(),
  now = Date.now(),
): boolean {
  const token = readCookie(cookieHeader, CONTROL_SESSION_COOKIE);
  return verifyControlSession(token, password, now);
}

export function controlAccessPolicy(pathname: string): ControlAccessPolicy {
  if (pathname === "/control/login") return null;
  if (pathname === "/control" || pathname.startsWith("/control/")) {
    return "page";
  }
  if (
    pathname === "/api/transcribe" ||
    pathname === "/api/transcribe/" ||
    pathname === "/api/interpret" ||
    pathname === "/api/interpret/"
  ) {
    return "api";
  }
  return null;
}

export function isControlEventAllowed(
  type: unknown,
  authenticated: boolean,
): boolean {
  if (typeof type !== "string") return false;
  if (DISPLAY_EVENT_TYPES.has(type)) return true;
  return authenticated && CONTROL_EVENT_TYPES.has(type);
}
