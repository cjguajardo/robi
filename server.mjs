// Production server entry. Runs Astro middleware + WebSocket on the same port.
// Usage:
//   pnpm build          # outputs dist/server/entry.mjs + dist/client/*
//   pnpm start          # runs this file (via tsx)

import { createServer } from "node:http";
import { createReadStream, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize } from "node:path";
import { attachWebSocket } from "./src/lib/realtime/ws.ts";
import { warmCache } from "./src/lib/tts/synthesize.ts";
import { CACHEABLE_PHRASES } from "./src/lib/robi/responses.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const builtEntry = join(__dirname, "dist", "server", "entry.mjs");
if (!existsSync(builtEntry)) {
  console.error(
    `[robi] dist/server/entry.mjs not found. Run "pnpm build" first.\n` +
      `       For development use "pnpm dev" (Astro dev server).`,
  );
  process.exit(1);
}

const { handler } = await import(builtEntry);

const MIME = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  ico: "image/x-icon",
  // MP3 served as audio/mpeg — required for `<audio>` decoding to
  // work cleanly across browsers (Chrome and Firefox accept
  // octet-stream via content sniffing, but Safari and embedded WebViews
  // can refuse without the explicit type). All catalog phrases and
  // the TTS fallback use this extension.
  mp3: "audio/mpeg",
  woff: "font/woff",
  woff2: "font/woff2",
  txt: "text/plain; charset=utf-8",
};

function serveStatic(req, res) {
  const clientDir = join(__dirname, "dist", "client");
  if (!existsSync(clientDir)) return false;
  const url = new URL(req.url ?? "/", "http://localhost");
  const safe = normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(clientDir, safe);
  if (!filePath.startsWith(clientDir)) return false;
  try {
    if (!statSync(filePath).isFile()) return false;
    const ext = filePath.split(".").pop() ?? "";
    res.setHeader("Content-Type", MIME[ext] ?? "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=3600");
    createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  if (serveStatic(req, res)) return;
  await handler(req, res);
});

attachWebSocket(server);

const port = Number(process.env.PORT ?? 4321);
const host = process.env.HOST ?? "0.0.0.0";
server.listen(port, host, () => {
  console.log(`[robi] http://${host}:${port}  (ws: /ws)`);
  // Pre-warm TTS for the most frequent phrases — see DESIGN.md §21.
  warmCache(CACHEABLE_PHRASES).catch((err) =>
    console.error("[robi] tts warmup failed", err),
  );
});
