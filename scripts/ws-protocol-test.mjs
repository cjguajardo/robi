// Manual protocol smoke test — connects to /ws, fires ANSWER_QUESTION,
// drives the audio lifecycle (preamble + answer), and dumps the event
// stream. Verifies that SPEECH_STARTED/ENDED come back as STATE_CHANGED.
//
// Run with: node scripts/ws-protocol-test.mjs (while `pnpm start` is up).
import { WebSocket } from "ws";

const ws = new WebSocket("ws://localhost:4321/ws");
const events = [];
let counter = 0;

ws.on("open", () => {
  console.log("✓ WS connected");
  console.log("→ sending COMMAND: ANSWER_QUESTION");
  ws.send(JSON.stringify({
    type: "COMMAND",
    payload: { type: "ANSWER_QUESTION", question: "que es un robot" },
  }));
});

ws.on("message", (raw) => {
  counter++;
  const ev = JSON.parse(raw.toString());
  const summary = formatEvent(ev);
  events.push({ n: counter, type: ev.type, summary });
  console.log(`[${counter}] ← ${ev.type}  ${summary || ""}`);

  // After the 1st SAY (preamble), simulate the client firing the audio
  // lifecycle events. In real code this comes from <audio>.play/.ended.
  const sayCount = events.filter(e => e.type === "SAY").length;
  if (ev.type === "SAY" && sayCount === 1) {
    scheduleLifecycleEvents("preamble");
  }
  if (ev.type === "SAY" && sayCount === 2) {
    scheduleLifecycleEvents("answer");
  }
  if (counter >= 8) {
    setTimeout(summaryAndExit, 300);
  }
});

ws.on("error", (err) => { console.error("WS error:", err.message); process.exit(1); });

function scheduleLifecycleEvents(label) {
  setTimeout(() => {
    console.log(`[client→server] SPEECH_STARTED (${label})`);
    ws.send(JSON.stringify({ type: "SPEECH_STARTED" }));
    setTimeout(() => {
      console.log(`[client→server] SPEECH_ENDED (${label})`);
      ws.send(JSON.stringify({ type: "SPEECH_ENDED" }));
    }, 50);
  }, 50);
}

function formatEvent(ev) {
  switch (ev.type) {
    case "SNAPSHOT":    return `state=${ev.payload.state}`;
    case "STATE_CHANGED": return ev.payload;
    case "WORLD_CHANGED":
      return `pos=(${ev.payload.position.x},${ev.payload.position.y}) dir=${ev.payload.direction}`;
    case "SAY":
      const txt = ev.payload.text ?? "";
      return `text="${txt.slice(0, 50)}${txt.length > 50 ? "..." : ""}" audioUrl=${ev.payload.audioUrl?.split("/").pop() || "none"}`;
    case "COMMAND":  return ev.payload.type;
    case "TRANSCRIPT": return `"${ev.payload}"`;
    default: return JSON.stringify(ev).slice(0, 60);
  }
}

function summaryAndExit() {
  console.log("\n=== SUMMARY ===");
  const states = events.filter(e => e.type === "STATE_CHANGED");
  console.log(`STATE_CHANGED events (${states.length}):`);
  states.forEach((s, i) => console.log(`  ${i + 1}. → ${s.summary}`));
  const says = events.filter(e => e.type === "SAY");
  console.log(`SAY events: ${says.length}`);
  ws.close();
  process.exit(0);
}

setTimeout(() => {
  console.error("\nTIMEOUT: 8s elapsed — check the server log.");
  ws.close();
  process.exit(1);
}, 8000);
