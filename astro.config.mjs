import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import { fileURLToPath } from "node:url";

// Astro + React + Node SSR — single monolith.
// Middleware mode lets us attach a WebSocket server to the same HTTP port
// (see DESIGN.md §38, §14). Custom server entry: ./server.mjs.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "middleware" }),
  integrations: [react()],
  server: {
    host: true,
  },
  // Astro 5+ enables CSRF origin-checking by default, blocking any
  // form-encoded / multipart / text-plain POST whose Origin header
  // doesn't match the Host. /control posts multipart/form-data with the
  // recorded audio, and the browser's Origin can drift from the Host in
  // realistic scenarios (reverse proxy, NAT, mismatched IP, dev server
  // bound to 0.0.0.0).
  //
  // Safe to disable here: the API endpoints are stateless request/
  // response — no cookies, no auth, no per-user mutations. The WebSocket
  // is also unauthenticated by design (DESIGN §15 — single shared
  // world). The CSRF threat model doesn't apply to this app.
  security: {
    checkOrigin: false,
  },
  vite: {
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      host: true,
    },
  },
});
