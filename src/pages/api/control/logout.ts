import type { APIRoute } from "astro";
import { CONTROL_SESSION_COOKIE } from "@/lib/auth/control-auth";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  cookies.delete(CONTROL_SESSION_COOKIE, { path: "/" });
  return redirect("/control/login", 303);
};
