import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTROL_SESSION_COOKIE, verifyControlSession } from "@/lib/auth/control-auth";
import { POST as login } from "./login";
import { POST as logout } from "./logout";

const PASSWORD = "route-test-password";
const originalPassword = process.env.CONTROL_PASSWORD;

function requestWithPassword(password: string): Request {
  const form = new FormData();
  form.set("password", password);
  return new Request("https://robi.example/api/control/login", {
    method: "POST",
    body: form,
  });
}

function routeContext(request: Request) {
  const cookies = {
    set: vi.fn(),
    delete: vi.fn(),
  };
  const redirect = vi.fn(
    (location: string, status = 302) =>
      new Response(null, { status, headers: { Location: location } }),
  );
  return { request, cookies, redirect };
}

describe("control login route", () => {
  beforeEach(() => {
    process.env.CONTROL_PASSWORD = PASSWORD;
  });

  afterEach(() => {
    if (originalPassword === undefined) delete process.env.CONTROL_PASSWORD;
    else process.env.CONTROL_PASSWORD = originalPassword;
  });

  it("sets a signed HttpOnly session and redirects to /control", async () => {
    const context = routeContext(requestWithPassword(PASSWORD));
    const response = await login(context as never);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/control");
    expect(context.cookies.set).toHaveBeenCalledOnce();
    const [name, value, options] = context.cookies.set.mock.calls[0];
    expect(name).toBe(CONTROL_SESSION_COOKIE);
    expect(verifyControlSession(value, PASSWORD)).toBe(true);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: 86_400,
    });
  });

  it("rejects a wrong password without setting a cookie", async () => {
    const context = routeContext(requestWithPassword("wrong"));
    const response = await login(context as never);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "/control/login?error=invalid",
    );
    expect(context.cookies.set).not.toHaveBeenCalled();
  });

  it("fails closed when CONTROL_PASSWORD is missing", async () => {
    delete process.env.CONTROL_PASSWORD;
    const context = routeContext(requestWithPassword(PASSWORD));
    const response = await login(context as never);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "/control/login?error=configuration",
    );
    expect(context.cookies.set).not.toHaveBeenCalled();
  });
});

describe("control logout route", () => {
  it("clears the session and redirects to login", async () => {
    const context = routeContext(
      new Request("https://robi.example/api/control/logout", { method: "POST" }),
    );
    const response = await logout(context as never);

    expect(context.cookies.delete).toHaveBeenCalledWith(
      CONTROL_SESSION_COOKIE,
      { path: "/" },
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/control/login");
  });
});
