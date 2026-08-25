import type { APIRoute } from "astro";
import {
  CONTROL_SESSION_COOKIE,
  CONTROL_SESSION_TTL_SECONDS,
  createControlSession,
  getControlPassword,
  verifyControlPassword,
} from "@/lib/auth/control-auth";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const configuredPassword = getControlPassword();
  if (!configuredPassword) {
    console.error("[control-auth] CONTROL_PASSWORD is not configured");
    return redirect("/control/login?error=configuration", 303);
  }

  let submittedPassword = "";
  try {
    const form = await request.formData();
    const value = form.get("password");
    if (typeof value === "string") submittedPassword = value;
  } catch {
    return redirect("/control/login?error=invalid", 303);
  }

  if (!verifyControlPassword(submittedPassword, configuredPassword)) {
    return redirect("/control/login?error=invalid", 303);
  }

  cookies.set(
    CONTROL_SESSION_COOKIE,
    createControlSession(configuredPassword),
    {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CONTROL_SESSION_TTL_SECONDS,
    },
  );

  return redirect("/control", 303);
};
