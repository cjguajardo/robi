import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTROL_SESSION_COOKIE, createControlSession } from "./lib/auth/control-auth";
import { onRequest } from "./middleware";

const PASSWORD = "middleware-test-password";
const originalPassword = process.env.CONTROL_PASSWORD;

function context(pathname: string, cookie?: string) {
  return {
    url: new URL(pathname, "https://robi.example"),
    request: new Request(new URL(pathname, "https://robi.example"), {
      headers: cookie ? { cookie } : undefined,
    }),
  };
}

function requireResponse(value: Response | void): Response {
  if (!(value instanceof Response)) throw new Error("Middleware returned no response");
  return value;
}

describe("control authentication middleware", () => {
  beforeEach(() => {
    process.env.CONTROL_PASSWORD = PASSWORD;
  });

  afterEach(() => {
    if (originalPassword === undefined) delete process.env.CONTROL_PASSWORD;
    else process.env.CONTROL_PASSWORD = originalPassword;
  });

  it("redirects an unauthenticated control page request to login", async () => {
    const next = vi.fn(async () => new Response("private"));
    const response = requireResponse(
      await onRequest(context("/control") as never, next),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/control/login");
    expect(next).not.toHaveBeenCalled();
  });

  it("protects the presentation controller under /control", async () => {
    const next = vi.fn(async () => new Response("private"));
    const response = requireResponse(
      await onRequest(context("/control/ppt") as never, next),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/control/login");
    expect(next).not.toHaveBeenCalled();
  });

  it("returns JSON 401 for an unauthenticated controller API", async () => {
    const next = vi.fn(async () => new Response("private"));
    const response = requireResponse(
      await onRequest(context("/api/interpret") as never, next),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: "CONTROL_AUTH_REQUIRED", message: "Authentication required" },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("allows an authenticated request and disables private response caching", async () => {
    const token = createControlSession(PASSWORD);
    const next = vi.fn(async () => new Response("private"));
    const response = requireResponse(
      await onRequest(
        context("/control", `${CONTROL_SESSION_COOKIE}=${token}`) as never,
        next,
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(next).toHaveBeenCalledOnce();
  });

  it("leaves the public display outside the authentication boundary", async () => {
    const next = vi.fn(async () => new Response("display"));
    const response = requireResponse(
      await onRequest(context("/display") as never, next),
    );

    expect(await response.text()).toBe("display");
    expect(next).toHaveBeenCalledOnce();
  });
});
