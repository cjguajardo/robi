import { describe, expect, it } from "vitest";
import {
  CONTROL_SESSION_COOKIE,
  controlAccessPolicy,
  createControlSession,
  isControlEventAllowed,
  readCookie,
  verifyControlPassword,
  verifyControlSession,
} from "./control-auth";

const PASSWORD = "correct horse battery staple";
const NOW = Date.UTC(2026, 7, 25, 12);

describe("control password authentication", () => {
  it("compares the submitted password against the configured password", () => {
    expect(verifyControlPassword(PASSWORD, PASSWORD)).toBe(true);
    expect(verifyControlPassword("wrong password", PASSWORD)).toBe(false);
    expect(verifyControlPassword(PASSWORD, undefined)).toBe(false);
  });

  it("creates a signed session that expires after the configured lifetime", () => {
    const token = createControlSession(PASSWORD, NOW);

    expect(verifyControlSession(token, PASSWORD, NOW)).toBe(true);
    expect(
      verifyControlSession(token, PASSWORD, NOW + 24 * 60 * 60 * 1_000 - 1),
    ).toBe(true);
    expect(
      verifyControlSession(token, PASSWORD, NOW + 24 * 60 * 60 * 1_000),
    ).toBe(false);
  });

  it("rejects missing, forged, and differently signed sessions", () => {
    const token = createControlSession(PASSWORD, NOW);
    const [payload, signature] = token.split(".");

    expect(verifyControlSession(undefined, PASSWORD, NOW)).toBe(false);
    expect(
      verifyControlSession(`${payload}.${signature}forged`, PASSWORD, NOW),
    ).toBe(false);
    expect(verifyControlSession(token, "another password", NOW)).toBe(false);
  });

  it("reads the session from a Cookie header without confusing cookie names", () => {
    expect(
      readCookie(
        `theme=dark; ${CONTROL_SESSION_COOKIE}=signed-token; another=value`,
        CONTROL_SESSION_COOKIE,
      ),
    ).toBe("signed-token");
    expect(
      readCookie(`not_${CONTROL_SESSION_COOKIE}=wrong`, CONTROL_SESSION_COOKIE),
    ).toBeUndefined();
  });
});

describe("control access policy", () => {
  it.each(["/control", "/control/"])("protects the control page %s", (path) => {
    expect(controlAccessPolicy(path)).toBe("page");
  });

  it.each([
    "/api/transcribe",
    "/api/transcribe/",
    "/api/interpret",
    "/api/interpret/",
  ])(
    "protects the control API %s",
    (path) => {
      expect(controlAccessPolicy(path)).toBe("api");
    },
  );

  it.each([
    "/control/login",
    "/api/control/login",
    "/api/control/logout",
    "/api/tts",
    "/display",
    "/",
  ])("leaves non-controller route %s outside the guard", (path) => {
    expect(controlAccessPolicy(path)).toBeNull();
  });
});

describe("WebSocket control authorization", () => {
  it.each([
    "COMMAND",
    "ADD_STAGE_ITEM",
    "TRANSCRIPT",
    "RESET",
    "PAUSE",
    "RESUME",
  ])("blocks unauthenticated control event %s", (type) => {
    expect(isControlEventAllowed(type, false)).toBe(false);
  });

  it.each(["SPEECH_STARTED", "SPEECH_ENDED"])(
    "allows the public display lifecycle event %s",
    (type) => {
      expect(isControlEventAllowed(type, false)).toBe(true);
    },
  );

  it("allows controller events for an authenticated peer", () => {
    expect(isControlEventAllowed("COMMAND", true)).toBe(true);
  });

  it.each(["SNAPSHOT", "STATE_CHANGED", "SAY", "WORLD_CHANGED"])(
    "continues to reject server-only inbound event %s",
    (type) => {
      expect(isControlEventAllowed(type, true)).toBe(false);
    },
  );
});
