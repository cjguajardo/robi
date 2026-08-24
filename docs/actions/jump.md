# JUMP

Salto vertical **en el lugar**. No avanza en la cuadrícula, no rota. La animación visible viene del CSS `@keyframes avatar-jump`.

## TL;DR

Comando de acción vertical in-place; sin cambio de position ni direction; usa weighted `frameSequence` para emular cadencia de salto real.

## Flowchart

```mermaid
flowchart LR
    USER([👤 "ROBI salta"]) -->|COMMAND| SVR

    subgraph SVR["🖥️ Server (server.ts)"]
        EXEC["EXECUTE → EXECUTING, pendingMove=null"]
        BR["SAY audioUrl jump-NN.mp3"]
        WAIT["waitForSpeechEnded"]
        COMP["COMPLETE → IDLE"]
        EXEC --> BR --> WAIT --> COMP
    end

    SVR -->|SAY| DISP

    subgraph DISP["📺 Display (Robi.tsx + avatar-jump CSS)"]
        PLAY[playSay]
        START[play → SPEECH_STARTED]
        END[ended → SPEECH_ENDED]
        JUMP[avatar-jump translateY CSS]
        PLAY --> START --> END
        START -.->|anim| JUMP
    end

    DISP -->|SPEECH_ENDED| SVR
    END -.->|resolves| WAIT
```

**Leyenda**: 🟦 server · 🟩 display. La traslación vertical viene del CSS `@keyframes avatar-jump`, no del reducer (no hay `APPLY_MOVEMENT`). `jumpKey` React key fuerza re-mount del wrap en cada JUMP para reiniciar la animación CSS.

## Forma

```ts
{ type: "JUMP" }
```

**Sin** `steps` — JUMP siempre es 1 bloque (kid-game semantics: el botón arriba = "salta uno", no selector).

## Disparador

### Parser local (`src/lib/robi/parser.ts:92`)

```ts
{ cmd: "JUMP", test: /\b(salta|saltar|salto|brinca|brincar|brinco)\b/ }
```

Sin `withSteps`.

### LLM fallback

`src/lib/llm/system-prompt.ts` puede devolver `JUMP`. Schema: `{type: "JUMP"}` (sin `steps`).

### Validación

Sin `steps`, no hay clamp. Schema acepta el literal.

## Audio

- **Categoría**: `JUMP`.
- **Archivos**: `public/audio/jump-{01,02}.mp3` (2 entradas).
- **Rotación**: counter per-categoría.
- **Texto de muestra**: "¡Hop!" / "¡Hyup!"

## State machine

| T | Event | Reducer | Sprite |
|---|---|---|---|
| 0 | `EXECUTE {command: JUMP}` | `EXECUTING`, `pendingMove = null` | `jumping` (track con `frameSequence`) |
| audio_start | `SPEECH_STARTED` (sonido de esfuerzo, sin `SPEAK`) | `EXECUTING` (sin cambio) | `jumping` (sigue, nunca `speaking`) |
| audio_end | `RETURN_TO_EXECUTION` (action) | `EXECUTING` | `jumping` (sigue) |
| post-delay | `COMPLETE` | `IDLE` | `idle` |

`actionAnimationMs(JUMP) = 700` ms.

**Detalle clave**: la traslación VISUAL viene del CSS, no del reducer. El MP3 de JUMP es un sonido de esfuerzo, no diálogo: `SPEECH_STARTED` mantiene `EXECUTING` para que el avatar no cambie al track `speaking`. Tanto el track de frames como `avatar-jump` se ejecutan exactamente una vez. Ver `Sprite track` abajo.

## Posición y dirección

- **Posición**: NO cambia. `pendingMove = null` en EXECUTE.
- **Dirección**: NO cambia. JUMP ignora el facing.

> **Decisión de diseño**: el usuario pidió "nunca fue girar, solo avanzar lateral; jump siempre es uno" — JUMP siempre es in-place (PRD §8). Las frases del catálogo no mencionan dirección ("¡Hop!", "¡Hyup!"), son genéricas.

Como NO hay `pendingMove`, no se dispatcha `APPLY_MOVEMENT` ni un segundo `WORLD_CHANGED`. Solo el `WORLD_CHANGED` post-EXECUTE (que lleva la MISMA posición y dirección).

## Flujo del servidor (`drainQueue`)

Branch genérico. Como `pendingMove` es null, el bloque APPLY_MOVEMENT no se ejecuta:

```ts
const phrase = responseForWithAudio(next);
const waiter = waitForSpeechEnded();
broadcast({ type: "SAY", payload: phrase });
await waiter;
// pendingMove === null → skip
state.processing = false;
await sleep(actionAnimationMs(next));  // 700ms
transition({ type: "COMPLETE" });
```

## Sprite track (`src/components/display/sprites.ts:104`)

```ts
jumping: {
  id: "jumping",
  row: 0,                    // comparte fila con IDLE
  startCol: 0,
  frameCount: 3,
  duration: 0.7,
  loop: false,
  frameSequence: [0, 1, 1, 2, 2, 0]   // weighted sequence
}
```

**3 celdas** con una `frameSequence` de 6 elementos. Los índices duplicados (1,1 y 2,2) producen HOLDS con timing `step-end`:

| Segmento | Porcentaje | Celda | Visual |
|---|---|---|---|
| 1 | 0 → 16.67% | 0 | crouch |
| 2 | 16.67 → 33% | 1 | push-off |
| 3 | 33 → 50% | 1 | **mid-air (HOLD)** |
| 4 | 50 → 67% | 2 | apex |
| 5 | 67 → 83% | 2 | **falling (HOLD)** |
| 6 | 83 → 100% | 0 | landed |

Esto emula la cadencia real de un salto: crouch → push → mid → apex → fall → land.

### CSS `@keyframes avatar-jump`

`src/styles/display.css:251` — translateY de 0 a -64px y vuelta, alineado con los 6 segmentos del sprite cycle.

### `jumpKey` mechanism

`src/components/display/Robi.tsx:35-41` mantiene un counter `jumpKey` que se incrementa en cada JUMP recibido vía WS. Se pasa como `key={jumpKey}` al wrap de avatar → fuerza React a re-mount ese subtree → el CSS animation se reinicia.

**Por qué necesario**: CSS animations no se reinician con className toggle; hay que re-mount el nodo. El kid presionando JUMP varias veces seguidas NO se queda atascado en el frame "landed".

## Edge cases

- **JUMP durante JUMP**: el segundo se rechaza (`state.processing`). Cliente recibe `STOP`.
- **Audio durante JUMP**: se reproduce normalmente y sigue enviando `SPEECH_STARTED`/`SPEECH_ENDED`, pero el servidor omite `SPEAK` solo para JUMP. Así el waiter de audio funciona sin mostrar la animación de hablar.
- **Salto en celda de borde**: no hay verificación (open world).
- **Visual no reinicia en multi-tap**: bug de `jumpKey`. Ver `Robi.tsx:79-82`.
- **El track no queda en loop**: `SPRITE_TRACKS.jumping.loop = false`; el CSS generado usa una iteración con fill `both`.

## Diagnóstico de "ruido"

| Síntoma | Dónde mirar |
|---|---|
| Avatar salta con el sprite equivocado | `src/lib/realtime/server.ts:89` (`isActionCommand`) — JUMP debe estar en la lista. |
| Posición cambia durante JUMP | `src/lib/robi/reducer.ts:156-162` — `pendingMove = null` debe estar. Bug = falta ese null. |
| Dirección rota durante JUMP | Mismo lugar que arriba. EXECUTE no debe tocar `direction`. |
| Animación visual no aparece | `src/styles/display.css:251-261` — verificar `@keyframes avatar-jump` y la duración 700ms. |
| Multi-tap JUMP no reinicia | `src/components/display/Robi.tsx:79-82` — `jumpKey` debe incrementarse en cada JUMP observado. |
| Avatar salta antes/después del audio | timing de `actionAnimationMs(JUMP) = 700`. Si querés más/menos, ajustar. |
| Peso del salto visual (altura) | `src/styles/display.css:251-261` — translateY máximo. Actual: -64px (escala con `--sprite-height`). |

## Puntos de tweak

| Querés cambiar... | Archivo:línea | Notas |
|---|---|---|
| Duración del salto visible | `src/lib/realtime/server.ts:actionAnimationMs()` case `JUMP` (actualmente 700ms) | |
| Altura del salto | `src/styles/display.css` `@keyframes avatar-jump` | Actual: -64px translateY. |
| Sprite frames (crouch/push-off/apex) | `src/components/display/sprites.ts:SPRITE_TRACKS.jumping` (frameSequence + duration) | Mantener segmentación 6-aligned con CSS. |
| Audio | `sonidos/audios.json` + `pnpm audios` | Categoría `JUMP`. |
| Cadencia (HOLDS) | `frameSequence` array | Indices duplicados = HOLD; cambia cantidad de HOLDS. |
| Multi-tap behavior | `src/components/display/Robi.tsx` (jumpKey counter) | Si querés que NO se reinicie, quitá el `key`. |

## Dependencias

- `src/types/robi.ts:14` — type literal
- `src/lib/robi/parser.ts:92` — regex
- `src/lib/robi/reducer.ts:156-162` — EXECUTE (pendingMove=null)
- `src/lib/robi/responses.ts:44` — categoryFor
- `src/components/display/sprites.ts:104` — SPRITE_TRACKS.jumping + frameSequence
- `src/lib/realtime/server.ts:isActionCommand()` (línea ~316)
- `src/components/display/Robi.tsx:35-82` — jumpKey + WS handler
- `src/styles/display.css:251-261` — @keyframes avatar-jump
- `sonidos/audios.json` — entradas `JUMP`
- `public/audio/jump-{01,02}.mp3`

## Tests

- `src/lib/robi/parser.test.ts`:
  - "parses 'robi salta' → JUMP"
  - "JUMP has no steps field"
- `src/lib/robi/reducer.test.ts`:
  - "JUMP sets state EXECUTING with null pendingMove"
- `src/lib/realtime/server.test.ts`:
  - "JUMP is in-place (no position change) and broadcasts EXECUTING → IDLE"
  - "JUMP keeps the jumping state while its sound plays"
  - "SPEECH_STARTED drives the state to SPEAKING" (otras acciones)
  - "SPEECH_ENDED drives action commands back to EXECUTING (action sprite)" (otras acciones)
