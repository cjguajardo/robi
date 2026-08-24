# references.md — Referencia global de ROBI

Documento de una sola parada para entender los sistemas transversales que comparten los 14 comandos. Cada sección se cita desde los archivos de `actions/`.

> **Si vienes acá desde un archivo de acción:** usá las anclas (e.g. `#state-machine`) para saltar directo al sistema que necesitás. Cada archivo de acción cita qué partes de este documento necesita.

## Índice

1. [State machine](#1-state-machine)
2. [Audio catalog](#2-audio-catalog)
3. [Sprite system](#3-sprite-system)
4. [Realtime (WebSocket)](#4-realtime-websocket)
5. [Patrones comunes](#5-patrones-comunes)
6. [Configuración](#6-configuracion)
7. [Mapa de archivos](#7-mapa-de-archivos)
8. [Invariantes no-obvios](#8-invariantes-no-obvios)

---

## 1. State machine

ROBI tiene **9 estados** y **11 eventos** del reducer. Es un reducer puro (`src/lib/robi/reducer.ts`) sin side effects — la UI computa timings de animación por separado.

### Estados (`RobiState`)

Definidos en `src/types/robi.ts`:

```ts
type RobiState =
  | "SLEEPING"     // al inicio
  | "IDLE"         // reposo entre acciones (estado terminal)
  | "LISTENING"    // mientras el micrófono captura audio
  | "THINKING"     // entre SAYs en contenido, o mientras el LLM piensa
  | "SPEAKING"     // mientras <audio>.play corre
  | "EXECUTING"    // mientras un comando activo se ejecuta
  | "CELEBRATING"  // solo durante CELEBRATE
  | "CONFUSED"     // solo cuando UNKNOWN matchea
  | "PAUSED"       // botón de emergencia
```

### Eventos (`RobiEvent`)

Definidos en `src/types/robi.ts`:

```ts
type RobiEvent =
  | { type: "WAKE" }                    // SLEEPING → IDLE
  | { type: "LISTEN" }                  // cualquier → LISTENING
  | { type: "THINK" }                   // después de escuchar/hablar
  | { type: "SPEAK" }                   // mientras se reproduce audio
  | { type: "EXECUTE"; command }        // procesa un RobiCommand
  | { type: "APPLY_MOVEMENT" }          // aplica pendingMove a position
  | { type: "RETURN_TO_EXECUTION" }     // SPEAKING → EXECUTING post-audio
  | { type: "ERROR" }                   // → CONFUSED
  | { type: "COMPLETE" }                // terminar comando → IDLE
  | { type: "PAUSE" }                   // → PAUSED
  | { type: "RESUME" }                  // PAUSED → IDLE
  | { type: "RESET" }                   // → initialWorld
```

### Tabla completa de transiciones

| Evento | Estado origen | Estado destino | Guarda |
|---|---|---|---|
| `WAKE` | SLEEPING | IDLE | – |
| `LISTEN` | cualquier no-PAUSED | LISTENING | – |
| `THINK` | LISTENING / IDLE / SPEAKING | THINKING | – |
| `SPEAK` | cualquier no-PAUSED | SPEAKING | – |
| `EXECUTE` (command) | cualquier | depende del command (ver abajo) | UNKNOWN → CONFUSED, otros → EXECUTING/CELEBRATING/IDLE |
| `APPLY_MOVEMENT` | – | sin cambio si pendingMove es null; sino aplica | idempotente |
| `RETURN_TO_EXECUTION` | SPEAKING | EXECUTING | solo si SPEAKING |
| `ERROR` | – | CONFUSED | – |
| `COMPLETE` | EXECUTING / SPEAKING / THINKING / CONFUSED | IDLE | – |
| `PAUSE` | – | PAUSED | – |
| `RESUME` | PAUSED | IDLE | – |
| `RESET` | – | initialWorld (SLEEPING) | – |

### EXECUTE por command (mapa completo)

| Command type | Estado final | Direction | pendingMove |
|---|---|---|---|
| `WALK_LEFT` | EXECUTING | WEST | `{x: -steps, y: 0}` |
| `WALK_RIGHT` | EXECUTING | EAST | `{x: +steps, y: 0}` |
| `JUMP` | EXECUTING | sin cambio | `null` |
| `STOP` | **IDLE** (directo) | sin cambio | `null` |
| `GREET` | EXECUTING | sin cambio | `null` |
| `DANCE` | EXECUTING | sin cambio | `null` |
| `CELEBRATE` | **CELEBRATING** | sin cambio | `null` |
| `RESET` | **IDLE** (vía initialWorld) | SOUTH | `null` |
| `TELL_JOKE` | EXECUTING | sin cambio | `null` |
| `TELL_RIDDLE` | EXECUTING | sin cambio | `null` |
| `TELL_FACT` | EXECUTING | sin cambio | `null` |
| `SAY_GOODBYE` | EXECUTING | sin cambio | `null` |
| `ANSWER_QUESTION` | EXECUTING | sin cambio | `null` |
| `UNKNOWN` | **CONFUSED** | sin cambio | `null` |

### Guard global: pausa

```ts
if (world.paused && event.type !== "RESUME" && event.type !== "RESET") {
  return world; // ignora todo excepto resume/reset
}
```

Implementado en `src/lib/robi/reducer.ts:86`. Cualquier evento (excepto RESUME/RESET) es no-op si paused.

---

## 2. Audio catalog

Sistema de audios pre-generados. **Single source of truth: `sonidos/audios.json`**. Se carga una vez a memoria por `src/lib/robi/audio-catalog.ts`.

### Categorías (`AudioCategory`)

```ts
type AudioCategory =
  | "WALK_LEFT" | "WALK_RIGHT" | "JUMP" | "STOP" | "GREET"
  | "DANCE" | "CELEBRATE"
  | "TELL_JOKE_PREAMBLE" | "JOKE"
  | "TELL_RIDDLE_PREAMBLE" | "RIDDLE"
  | "TELL_FACT_PREAMBLE" | "FACT"
  | "ANSWER_QUESTION_PREAMBLE" | "ANSWER_QUESTION_FALLBACK"
  | "SAY_GOODBYE" | "UNKNOWN"
  | "BUG" | "PAUSED" | "RESUMED" | "COMPLETE";
```

Cada categoría es un strip de celdas del `sonidos/audios/` correspondiente (los archivos .mp3). Se sirven como `/audio/<filename>.mp3` desde `public/audio/`.

### Funciones del catálogo

| Función | Cuándo usarla | Throw en vacío |
|---|---|---|
| `pick(category)` | categoría con audios garantizados | **throw** si vacío |
| `tryPick(category)` | categoría opcional (preambles) | null si vacío |

`pick` se usa para respuestas garantizadas (WALK, JOKE, etc.). `tryPick` se usa para preambles (puede que aún no se hayan generado).

### Rotación

Counter per-categoría. `(counter[cat] ?? 0) % list.length`. **Cada categoría tiene su propio counter**, así categorías ocupadas no afectan a las silenciosas.

### Audio URL

Cada `AudioEntry` tiene `audioUrl: '/audio/${filename}'`. Estos archivos se sirven desde `public/audio/` (copia de `sonidos/audios/`).

### Si una categoría está vacía

- `pick()` → throw (programmer error)
- `tryPick()` → null (degradación elegante)

Los preambles y el ANSWER_QUESTION_FALLBACK se sirven con `tryPick` así no rompen si todavía no se generaron.

### Regeneración

```bash
pnpm audios          # regenera todo con OpenAI TTS
pnpm audios:install  # copia de sonidos/audios/ a public/audio/
```

Ver `sonidos/README.md` para detalles de generación.

---

## 3. Sprite system

El avatar se renderiza como un `<div>` con `display-sprites.webp` de fondo, ciclando entre celdas vía CSS keyframes generadas en runtime.

### Layout del sprite sheet

```
SPRITE_IMAGE_WIDTH  = 1900
SPRITE_IMAGE_HEIGHT = 976         (ajustado tras redesign del sprite)
SPRITE_COLUMNS      = 10
SPRITE_ROWS         = 4
SPRITE_CELL_WIDTH   = 190        (= 1900 / 10)
SPRITE_CELL_HEIGHT  = 244        (= 976 / 4)
```

**Importante**: estas dimensiones de la imagen real NO se usan en runtime. El render context es siempre `{ cellWidth: 240, cellHeight: 360 }` (pasado por `RobiAvatar.tsx`). El CSS escala la imagen al render size. Las constantes solo existen para que el test detecte drift.

### `SPRITE_TRACKS` (catálogo de animaciones)

Definido en `src/components/display/sprites.ts`. Map por track id:

```ts
SPRITE_TRACKS = {
  idle:         { row: 0, startCol: 0, frameCount: 1, duration: 1.8 },
  sleeping:     { row: 0, startCol: 3, frameCount: 3, duration: 2.4 },
  wakeup:       { row: 0, startCol: 7, frameCount: 3, duration: 1.0 },
  listening:    { row: 1, startCol: 0, frameCount: 3, duration: 1.4 },
  thinking:     { row: 1, startCol: 3, frameCount: 4, duration: 1.6 },
  speaking:     { row: 1, startCol: 7, frameCount: 3, duration: 0.45 },
  walking:      { row: 2, startCol: 0, frameCount: 4, duration: 0.7 },
  waving:       { row: 2, startCol: 4, frameCount: 3, duration: 0.9 },
  happy:        { row: 2, startCol: 7, frameCount: 1, duration: 0.0 },
  confused:     { row: 2, startCol: 8, frameCount: 2, duration: 0.6 },
  dancing:      { row: 3, startCol: 0, frameCount: 6, duration: 0.55 },
  celebrating:  { row: 3, startCol: 6, frameCount: 4, duration: 0.5 },
  paused:       { row: 0, startCol: 3, frameCount: 3, duration: 2.4 }, // = sleeping
  jumping:      { row: 0, startCol: 0, frameCount: 3, duration: 0.7, frameSequence: [0, 1, 1, 2, 2, 0] },
}
```

> JUMP está en row 0 desde el último redesign (compartiendo celdas con IDLE; JUMP usa `frameSequence` con HOLDS para emular cadencia de salto).

### State → Track (`spriteTrackFor`)

```ts
function spriteTrackFor(state, command): SpriteTrack
```

| State | Track (default) | Track si command es X |
|---|---|---|
| SLEEPING | sleeping | – |
| IDLE | idle | – |
| LISTENING | listening | – |
| THINKING | thinking | – |
| SPEAKING | speaking | – |
| CELEBRATING | celebrating | – |
| CONFUSED | confused | – |
| PAUSED | paused | – |
| EXECUTING | walking (fallback) | depende del command (ver ACTIONS.md) |

### CSS generado

`generateAvatarStylesheet(ctx)` produce:
- `.avatar-sprite { background-image: url('/display-sprites.webp'); background-size: 2400px 1440px; }`
- Un `@keyframes sprite-<id>` por track (con HOLDS si tiene `frameSequence`)
- Una regla `.avatar-sprite[data-anim="<id>"] { animation: sprite-<id> <duration>s step-end infinite; }`

### Por qué `step-end` (no `linear` ni `steps(N)`)

- `linear` interpola entre keyframes → sprite se desliza entre celdas (malo)
- `steps(N)` samplea el global start-to-end → slides (malo)
- `step-end` (≡ `steps(1, jump-end)`) mantiene el valor START del segmento entero, jump-to-END en el boundary → discreto, limpio

Con un keyframe por celda, cada celda se muestra `100/N %` del tiempo con jump limpio a la siguiente.

### `frameSequence` weighted (JUMP)

```ts
frameSequence: [0, 1, 1, 2, 2, 0]
```

El keyframe loop emite 6 keyframes a `0%, 16.67%, 33.33%, 50%, 66.67%, 83.33%` con posiciones de celdas 0, 1, 1, 2, 2, 0. Los índices duplicados producen HOLDS (misma celda durante el segmento) → emula crouch → push-off → mid-air hold → apex hold → falling → land.

### Orientation transforms

```ts
DIRECTION_TRANSFORM = {
  NORTH: "rotate(180deg)",   // away del audience
  EAST:  "scaleX(1)",        // facing right
  SOUTH: "",                 // facing audience (default)
  WEST:  "scaleX(-1)",       // facing left (mirror)
}
```

No `rotate(90deg)` para EAST/WEST — eso hace que el robot parezca tirado. El `scaleX(-1)` mirror es la convención de plataformeros 2D.

---

## 4. Realtime (WebSocket)

ROBI usa WebSocket bidireccional entre `/control` y `/display`. Un solo proceso, un solo mundo compartido (`src/lib/realtime/server.ts:43-52`).

### Wire format

`RealtimeEvent` es un discriminated union (sin envelope, sin session id). Definido en `src/types/robi.ts:82-98`.

```ts
type RealtimeEvent =
  | { type: "COMMAND"; payload: RobiCommand }
  | { type: "STATE_CHANGED"; payload: RobiState }
  | { type: "WORLD_CHANGED"; payload: { position, direction } }
  | { type: "SPEECH_STARTED" }
  | { type: "SPEECH_ENDED" }
  | { type: "TRANSCRIPT"; payload: string }
  | { type: "SAY"; payload: SayPayload }
  | { type: "RESET" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "SNAPSHOT"; payload: SessionSnapshot };
```

### Cliente → Servidor

- `COMMAND` (con RobiCommand) — comando del operador/voz
- `RESET`, `PAUSE`, `RESUME` — controles globales

### Servidor → todos los peers

- `SNAPSHOT` (al conectar) — estado completo para sincronizar
- `STATE_CHANGED` (en cada transition) — RobiState nuevo
- `WORLD_CHANGED` (post-EXECUTE) — nueva posición + dirección
- `COMMAND` (eco) — el comando procesado (para que el display sepa qué track usar)
- `SAY` (en SAY emitido) — texto + opcional audioUrl
- `SPEECH_STARTED` / `SPEECH_ENDED` — **el display envía estos al servidor**, no al revés

### Single shared world

```ts
const state: World = { ... }  // module-private singleton en server.ts
```

- Cero sesiones, cero query params, cero envelopes
- Una sola instancia de `RobiCommand queue`
- Si necesitás dos setups en la misma red, levantá otro proceso en otro puerto

### `drainQueue()` — flujo principal

```ts
async function drainQueue(): Promise<void> {
  if (state.processing) return;
  const next = state.queue.shift();
  if (!next) return;

  state.processing = true;
  broadcast({ type: "COMMAND", payload: next });
  transition({ type: "EXECUTE", command: next });
  broadcast({ type: "WORLD_CHANGED", payload: { position, direction } });

  // Branch por tipo de comando — ver actions/*.md
  if (next.type === "ANSWER_QUESTION") { /* fork + LLM */ }
  else if (TELL_JOKE || TELL_RIDDLE || TELL_FACT) { /* preamble + content */ }
  else { /* single SAY */ }

  if (pendingMove) {
    transition({ type: "APPLY_MOVEMENT" });
    broadcast({ type: "WORLD_CHANGED", payload: ... });
  }

  state.processing = false;
  await sleep(actionAnimationMs(next));  // post-audio visual delay
  transition({ type: "COMPLETE" });

  if (state.queue.length > 0) drainQueue();
}
```

### `waitForSpeechEnded()` — el gate de audio

```ts
function waitForSpeechEnded(): Promise<void>
```

Devuelve una Promise que resuelve cuando el display envía `SPEECH_ENDED`. Safety timer dinámico: `audioDurationMs + 2s` si el audio tiene duración conocida (catálogo), sino **8s** ceiling (TTS dinámico / tests). El buffer cubre WS roundtrip + audio decode tail + un poco de slack. La fórmula exacta está en `server.ts:AUDIO_SAFETY_BUFFER_MS`.

**Regla crítica**: el waiter se monta **antes** de broadcastear el SAY que querés esperar, no después. Si llega un SPEECH_ENDED race-ahead, el resolver ya está listo para tomarlo. Pero la sobreescritura del resolver (entre preámbulo y contenido) es el detalle crítico — ver patrón §5.

### Procesamiento por command (drainQueue)

| Command | Branch | Waiter | Comentario |
|---|---|---|---|
| ANSWER_QUESTION | fork SAY(preamble) + LLM; luego SAY(answer) | sobre el answer | único con LLM runtime |
| TELL_JOKE/RIDDLE/FACT | SAY(preamble) → sleep 1.2s → SAY(content) | sobre el content | preámbulos son "decorativos" |
| Otros | SAY(phrase) | sobre el phrase | simple |
| RESET vía `ingestWorldEvent("RESET")` | sin drainQueue, corta todo | – | emergency path |

---

## 5. Patrones comunes

### 5.1 Waiter pattern (preamble + content)

```
broadcast SAY(preamble)  // NO waiter
sleep(preambleDurationMs(kind) + CONTENT_BUFFER_MS)  // dynamic per-audio + 100ms buffer
waiter = waitForSpeechEnded()
broadcast SAY(content)   // waiter cubre ESTE
await waiter
```

**NUNCA** montar waiter antes del preámbulo — el SPEECH_ENDED del preámbulo (cuando el cliente termina de reproducir el preámbulo) lo consumiría y el waiter del content quedaría huérfano. Ver `actions/tell-joke.md` para el detalle.

### 5.2 Fork pattern (ANSWER_QUESTION)

```
fork:
  broadcast SAY(preamble)        ┐ en paralelo
  llmPromise = LLM.call(question) ┘
await llmPromise
audio = await synthesizeSpeech(text)
broadcast SAY({text, audioUrl: data:…mp3})
```

Único caso donde se paraleliza. Preámbulo suena mientras LLM piensa; nada más se solapa.

### 5.3 Action vs Content command

```ts
function isActionCommand(cmd): boolean {
  // WALK_LEFT, WALK_RIGHT, JUMP, DANCE, CELEBRATE, GREET, SAY_GOODBYE → true
}
```

- Action: en SPEECH_ENDED, `RETURN_TO_EXECUTION` mantiene el sprite (caminando, bailando, etc.) hasta el visualDelay
- Content: en SPEECH_ENDED, `COMPLETE` directo a IDLE. Versiones anteriores pasaban por THINKING (broadcast intermedio), pero ese rebote dejaba al avatar en el loop de 4 frames de "pensando" lo suficiente para ser visible — sobre todo durante el gap preamble→content de TELL_FACT y similares, donde el gap dura `preambleDurationMs + CONTENT_BUFFER_MS`. Skipear el THINK mantiene la percepción "ROBI terminó de hablar, está en reposo".

### 5.4 Command rejection

```ts
if (state.processing) return { type: "STOP" };
```

Mientras un comando corre, los siguientes se rechazan devolviendo `STOP` al cliente (no se queuean, no se pierden — el cliente puede reintentar). Política del MVP: simple, predecible.

### 5.5 Fallback chain (ANSWER_QUESTION)

```
fallback 1: OPENAI_API_KEY missing → questionFallbackResponse() (catalog audio)
fallback 2: LLM timeout/network → mismo
fallback 3: TTS fails → text-only SAY → cliente hace /api/tts
fallback 4: /api/tts fails → silencio (no error visible al niño)
```

Tres niveles de degradación, todos silenciosos para el niño. Solo el operador (`/control` muestra logs).

### 5.6 Catalog fallback pattern

Cuando un comando necesita audio y no hay entry pre-generado:

- `categoryFor(type) → null` → `dynamicFallback(type) → "literal text"`
- Cliente sintetiza con `/api/tts`
- LRU cache en `synthesize.ts` evita re-hit a OpenAI

Usado por: `RESET` (literal "Vuelvo al inicio.") y `ANSWER_QUESTION` (respuesta del LLM).

---

## 6. Configuración

`src/lib/robi/config.server.ts` — única config persistente del servidor.

```ts
export const SERVER_CONFIG = {
  maxSteps: 10,            // cap superior para WALK_LEFT/RIGHT
  defaultSteps: 5,         // si no se menciona número
  llmFallbackEnabled: false, // deshabilitado por defecto (determinístico)
  speechEnabled: true,
  ttsEnabled: true,
};
```

> En el MVP, `llmFallbackEnabled` está en `false`. El parser local cubre los intents. Si está `true`, las transcripciones que devuelven `UNKNOWN` del parser local van al LLM (`/api/interpret`) antes de broadcastear `UNKNOWN`.

### Variables de entorno (leídas de `.env`)

| Variable | Default | Usado en |
|---|---|---|
| `OPENAI_API_KEY` | requerido para STT/TTS/LLM | `src/lib/llm/answer-question.ts`, `src/lib/tts/synthesize.ts` |
| `TTS_VOICE` | `fable` | `src/lib/tts/synthesize.ts` |
| `PORT` | 4321 | `server.mjs` |
| `HOST` | 0.0.0.0 | `server.mjs` |

---

## 7. Mapa de archivos

### Capa de dominio (lo más cerca al producto)

| Archivo | Responsabilidad |
|---|---|
| `src/types/robi.ts` | Types: `RobiCommand`, `RobiState`, `RobiEvent`, `RealtimeEvent`, `SayPayload`, `SessionSnapshot`, `RobiConfig` |
| `src/lib/robi/commands.ts` | `BLOCK_PX`, `MS_PER_BLOCK` (constantes de UI) |
| `src/lib/robi/parser.ts` | Parser determinístico (regex/keyword); `parseCommand()` |
| `src/lib/robi/validator.ts` | Schema + clamp; `validateCommand()` |
| `src/lib/robi/reducer.ts` | State machine puro; `reduceWorld()`, `initialWorld`, `runCommand()` |
| `src/lib/robi/responses.ts` | Audio catalog adapter; `responseForWithAudio()`, `questionPreambleResponse()`, etc. |
| `src/lib/robi/audio-catalog.ts` | Carga y rotation del catálogo desde `sonidos/audios.json`; `pick()`, `tryPick()` |
| `src/lib/robi/config.server.ts` | SERVER_CONFIG |

### Capa de inteligencia (LLM)

| Archivo | Responsabilidad |
|---|---|
| `src/lib/llm/system-prompt.ts` | Prompt del parser fallback (devuelve JSON tipado) |
| `src/lib/llm/answer-question.ts` | `answerQuestion()` para ANSWER_QUESTION |
| `src/lib/speech/transcription.ts` | Capa STT (si la hay — actualmente pasa al endpoint) |

### Capa de TTS

| Archivo | Responsabilidad |
|---|---|
| `src/lib/tts/synthesize.ts` | `synthesizeSpeech()`, LRU cache, `warmCache()` |

### Capa realtime

| Archivo | Responsabilidad |
|---|---|
| `src/lib/realtime/events.ts` | Helpers del wire format |
| `src/lib/realtime/server.ts` | Singleton state + `drainQueue`, `transition`, `waitForSpeechEnded` |
| `src/lib/realtime/ws.ts` | WebSocket attachment (`/ws` en el mismo puerto) |

### Capa display

| Archivo | Responsabilidad |
|---|---|
| `src/components/display/Robi.tsx` | Vista top-level; maneja WS, audio, parallax |
| `src/components/display/RobiAvatar.tsx` | Sprite div + dirección transform |
| `src/components/display/RobiFace.tsx` | Cara interna (overlay) |
| `src/components/display/RobiSpeechBubble.tsx` | Burbuja de habla |
| `src/components/display/RobiStatus.tsx` | Indicador de estado (debug overlay) |
| `src/components/display/sprites.ts` | `SPRITE_TRACKS`, `spriteTrackFor`, generación de CSS |

### Capa control

| Archivo | Responsabilidad |
|---|---|
| `src/components/control/Controller.tsx` | Vista top-level (teléfono) |
| `src/components/control/MicrophoneButton.tsx` | Captura de audio |
| `src/components/control/TranscriptPanel.tsx` | Muestra transcripción |
| `src/components/control/CommandPanel.tsx` | Botones manuales + dpad |
| `src/components/control/EmergencyControls.tsx` | Botón de pausa/emergencia |
| `src/components/control/RobiStateBadge.tsx` | Estado visual |
| `src/components/control/StepPicker.tsx` | Selector de steps (1-10) |

### Endpoints

| Archivo | Responsabilidad |
|---|---|
| `src/pages/api/interpret.ts` | POST {text} → {command, source} (LLM fallback) |
| `src/pages/api/transcribe.ts` | POST audio → {text} (STT) |
| `src/pages/api/tts.ts` | POST {text} → audio bytes (TTS server-side con LRU) |
| `src/pages/display.astro` | Página del proyector |
| `src/pages/control.astro` | Página del teléfono |
| `src/pages/index.astro` | Landing |

### Estilos y configuración

| Archivo | Responsabilidad |
|---|---|
| `src/styles/global.css` | Design tokens, reset, home page |
| `src/styles/display.css` | Avatar sprite, parallax, jump keyframes |
| `src/styles/control.css` | Phone UI |
| `astro.config.mjs` | Astro config con SSR adapter `@astrojs/node` |
| `tsconfig.json` | TypeScript config |
| `vitest.config.ts` | Vitest config |

### Scripts y entry points

| Archivo | Responsabilidad |
|---|---|
| `server.mjs` | Production server (HTTP + WS en mismo puerto) |
| `sonidos/generate.mjs` | Genera audios desde `audios.json` con OpenAI TTS |
| `sonidos/audios.json` | **Single source of truth** para frases + categorías |
| `sonidos/audios/` | MP3s originales generados |
| `public/audio/` | MP3s servidos al display (copia de `sonidos/audios/`) |
| `scripts/ws-protocol-test.mjs` | Test manual del wire format |

---

## 8. Invariantes no-obvios

Cosas que NO se ven leyendo el código superficialmente, pero que pasan. Si vas a tocar el código, leé esto primero.

### Single shared world
Una sola instancia de `state` en `src/lib/realtime/server.ts`. No hay sesiones, no hay query params, no hay envelopes. Si necesitás aislar, levantá otro proceso.

### Command rejection durante procesamiento
Mientras un comando corre (`state.processing === true`), los siguientes se rechazan devolviendo `STOP` al cliente. El comando rechazado NO se queuea. Si necesitás queuear, abrí otro proceso.

### World state puede quedar inconsistente durante PAUSED
El guard global en `reducer.ts:86` ignora todo evento excepto `RESUME`/`RESET`. Pero `drainQueue` puede seguir ejecutando audio de un comando que empezó antes de la pausa. Si querés cortar todo de verdad, usá `ingestWorldEvent("PAUSE")` que vacía la queue Y resetea `processing`.

### `playing audio` no requiere lock
Los SAYs se broadcastean sin lock. Si llegan dos SAYs "simultáneos" (uno durante un speech anterior), `Robi.tsx:playSay()` llama `stopAudio()` primero. No hay race condition visible — el último gana.

### IDLE animation es por defecto
Sin command activo, el avatar muestra el track `idle` (row 0, col 0, frameCount 1 — una sola celda estática tras el redesign). Si querés animarlo, cambiá el `frameCount` en `SPRITE_TRACKS.idle`.

### ANSWER_QUESTION es path crítico
Único comando que toca LLM Y TTS en runtime. Ver `actions/answer-question.md` para el detalle de pipeline + degradación. **NUNCA** generalices este patrón a otros comandos sin una buena razón — la latencia extra del LLM es inaceptable para WALK, JUMP, etc.

### `jumping.row = 0` (shared con IDLE)
Tras el redesign del sprite (post-inicialización), JUMP y IDLE comparten celdas. JUMP usa `frameSequence: [0, 1, 1, 2, 2, 0]` para que el sprite cyclé aunque las celdas sean las mismas. Ver `sprites.ts:104` y el comentario alrededor.

### Display no necesita estar conectado para emitir SAYs
`broadcast()` itera sobre `state.peers` y falla silenciosamente en errores. Si el display está caído, los SAYs se pierden (no se queuean). El emergency path `ingestWorldEvent("PAUSE")` SIEMPRE funciona porque no depende del display.

### Audio lifecycle depende del display mandando SPEECH_ENDED
Si el display peer nunca responde (browser tab cerrado, network caida, audio decoding fail), el `waitForSpeechEnded()` termina por safety timer. El timer se dimensiona con `audioDurationMs + 2s` si la duración del audio es conocida (catálogo — ej. fact-01 es 13.2s), o con un ceiling fijo de 8s para TTS dinámico. Esto unblocksa `drainQueue`. Si bajás el ceiling a < duración típica de audios largos, vas a cortar audios en producción.

### El LRU de TTS es bounded (32 entradas)
`synthesize.ts:CACHE.size >= 32` → descarta el más viejo. Para el MVP está bien (las frases frecuentes son ~15 y se cachean todas). Si crece el catálogo o aparecen frases LLM repetidas, considerá aumentar el cap o cambiar a LFU.

### NO se almacena nada persistente
PRD §14: sin DB, sin auth, sin cookies, sin localStorage de sesión. Cada comando es stateless. Si necesitás historial, armá un append-only log en memoria que se pierde al cerrar el proceso.
