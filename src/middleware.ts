import type { MiddlewareHandler } from "astro";
import {
  controlAccessPolicy,
  isControlCookieAuthenticated,
} from "@/lib/auth/control-auth";

export const onRequest: MiddlewareHandler = async (context, next) => {
  const policy = controlAccessPolicy(context.url.pathname);
  if (!policy) return next();

  const authenticated = isControlCookieAuthenticated(
    context.request.headers.get("cookie"),
  );

  if (!authenticated) {
    if (policy === "page") {
      return new Response(null, {
        status: 303,
        headers: {
          Location: "/control/login",
          "Cache-Control": "private, no-store",
          Vary: "Cookie",
        },
      });
    }

    return Response.json(
      {
        error: {
          code: "CONTROL_AUTH_REQUIRED",
          message: "Authentication required",
        },
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "private, no-store",
          Vary: "Cookie",
        },
      },
    );
  }

  const response = await next();
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.append("Vary", "Cookie");
  return response;
};
