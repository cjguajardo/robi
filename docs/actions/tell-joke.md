# TELL_JOKE

Contar un chiste. El niño dice "cuenta un chiste" / "ROBI hazme reír"; el operador usa el botón "😂".

## TL;DR

Comando de contenido pre-grabado con preámbulo + chiste + gap de 1.2s entre ellos. Audio del catálogo (2 audios pre-generados por preámbulo, 7 chistes).

## Flowchart

```mermaid
flowchart LR
    USER([👤 "cuenta un chiste"]) -->|COMMAND| SVR

    subgraph SVR["🖥️ Server (server.ts:185)"]
        EXEC["EXECUTE"]
        BR1["SAY preamble (audioUrl)"]
        SLEEP["sleep 1200ms"]
        BR2["SAY joke (audioUrl)"]
        WAIT["waitForSpeechEnded"]
        COMP["COMPLETE → IDLE"]
        EXEC --> BR1 --> SLEEP --> BR2 --> WAIT --> COMP
    end

    SVR -->|SAY ×2| DISP

    subgraph DISP["📺 Display"]
        P1[playSay preamble]
        S1[play → SPEECH_STARTED]
        E1[ended → SPEECH_ENDED]
        P2[playSay joke]
        S2[play → SPEECH_STARTED]
        E2[ended → SPEECH_ENDED]
        P1 --> S1 --> E1
        P2 --> S2 --> E2
    end

    DISP -->|SPEECH_ENDED| SVR
    E1 -.->|"no waiter (gotcha!)"| BR1
    E2 -.->|resolves| WAIT
```

**Leyenda**: 🟦 server · 🟩 display. Flujo secuencial estricto (preámbulo → gap → contenido). **Gotcha crítico**: el `waiter` se monta DESPUÉS del preámbulo — el `SPEECH_ENDED` del preámbulo no resuelve el waiter del contenido (porque aún no existe). Montar waiter antes del preámbulo = queue hang.

## Forma

```ts
{ type: "TELL_JOKE" }
```

## Disparador

### Parser local (`src/lib/robi/parser.ts:103`)

```ts
{ cmd: "TELL_JOKE", test: /\b(chiste|chistes|contame un chiste|cuenta un chiste|hazme reir|gracioso|graciosa)\b/ }
```

## Audio (preámbulo + contenido)

Dos SAYs:

| # | Categoría | Archivos | Rotación |
|---|---|---|---|
| 1 (preámbulo) | `TELL_JOKE_PREAMBLE` | `public/audio/joke-preamble-{01,02}.mp3` | 2 entries |
| 2 (chiste) | `JOKE` | `public/audio/joke-{01..07}.mp3` | 7 entries |

**Gap fijo entre preámbulo y chiste: 1200ms** (`PREAMBLE_TO_CONTENT_DELAY_MS`).

## State machine

| T | Event | Reducer | Sprite |
|---|---|---|---|
| 0 | `EXECUTE` | `EXECUTING` | `speaking` (track) |
| preámbulo_end | (waiter NO activo) | sin cambio | `speaking` |
| preámbulo_end + 1.2s | SAY(content) broadcast | sin cambio | `speaking` |
| chiste_end | `THINK` (content) | THINKING | `thinking` |
| post-audio | `COMPLETE` | `IDLE` | `idle` |

`actionAnimationMs(TELL_JOKE) = 0` (content command).

## Posición y dirección

No cambia. `pendingMove = null`.

## Flujo del servidor (rama dedicada)

`src/lib/realtime/server.ts:185-216` (rama `TELL_JOKE || TELL_RIDDLE || TELL_FACT`):

```ts
const kind = next.type === "TELL_JOKE" ? "joke" : ...;
const preamble = contentPreambleResponse(kind);  // tryPick("…_PREAMBLE")
if (preamble) {
  broadcast({ type: "SAY", payload: preamble });   // NO waiter
  await sleep(PREAMBLE_TO_CONTENT_DELAY_MS);      // 1200ms
}
const phrase = responseForWithAudio(next);        // tryPick("JOKE")
const waiter = waitForSpeechEnded();              // MOUNT AHORA
broadcast({ type: "SAY", payload: phrase });
await waiter;                                     // gate para SPEECH_ENDED del chiste
```

### ⚠️ Gotcha del waiter

**NO montar waiter antes del preámbulo**. El `SPEECH_ENDED` del preámbulo resolvería el waiter del contenido, y el chiste quedaría sin gate. Esto está documentado en AGENTS.md §"Waiter pattern".

## Sprite track

`speaking` (track, 3 frames, 0.45s loop). El sprite de boca moviéndose. Mapping en `spriteTrackFor`: TELL_JOKE y TELL_FACT → `speaking`; TELL_RIDDLE → `thinking`.

> Curiosidad: TELL_RIDDLE usa `thinking` (mano en la barbilla, dudando), no `speaking`. Decisión de UX: la adivinanza necesita pensar antes.

## Edge cases

- **Catálogo de preámbulos vacío**: `tryPick` devuelve null → no se broadcastea preámbulo. Funciona como antes (solo el chiste).
- **Catálogo de chistes vacío**: `pick` (no `tryPick`) lanza error. Si pasa, regenerate con `pnpm audios`.
- **TELL_JOKE durante ANSWER_QUESTION**: WAIT activa del TELL_JOKE (mientras LLM piensa). Después que el LLM responde, TELL_JOKE entra a la cola. Loco pero funciona.

## Diagnóstico de "ruido"

| Síntoma | Dónde mirar |
|---|---|
| Preámbulo no suena | `sonidos/audios/joke-preamble-NN.mp3` no existe. Correr `pnpm audios`. |
| Gap entre preámbulo y chiste muy largo/corto | `src/lib/realtime/server.ts:PREAMBLE_TO_CONTENT_DELAY_MS` (línea 467, constante 1200). |
| Chiste suena dos veces (preámbulo y contenido se repiten) | Bug en `drainQueue`. Verificar que solo hay 2 SAYs en la rama TELL_JOKE. |
| Sprite no muestra `speaking` durante el chiste | `src/components/display/sprites.ts:spriteTrackFor()` case `TELL_JOKE` debe devolver `SPRITE_TRACKS.speaking`. |
| El chiste no termina, queue se traba | Cliente no manda `SPEECH_ENDED`. Safety timer (8s) lo unblockea. Debug del cliente: `Robi.tsx` audio event listeners. |

## Puntos de tweak

| Querés cambiar... | Archivo:línea |
|---|---|
| Gap preámbulo→chiste | `src/lib/realtime/server.ts:PREAMBLE_TO_CONTENT_DELAY_MS` |
| Sprite durante el chiste | `src/components/display/sprites.ts:spriteTrackFor()` case `TELL_JOKE` |
| Preámbulos | `sonidos/audios.json` `TELL_JOKE_PREAMBLE` + `pnpm audios` |
| Chistes (texto/audio) | `sonidos/audios.json` `JOKE` + `pnpm audios` |
| Palabras que disparan | `src/lib/robi/parser.ts:103` |

## Dependencias

- `src/types/robi.ts:22`
- `src/lib/robi/parser.ts:103`
- `src/lib/robi/reducer.ts:177-186` (case content)
- `src/lib/robi/responses.ts:58` (categoryFor)
- `src/lib/robi/responses.ts:196-209` (contentPreambleResponse)
- `src/lib/realtime/server.ts:185-216` (rama dedicada)
- `src/components/display/sprites.ts:225-227`
- `sonidos/audios/joke-preamble-{01,02}.mp3` + `joke-{01..07}.mp3`

## Tests

- `src/lib/realtime/server.test.ts`:
  - "TELL_JOKE broadcasts SAY: preamble then joke (after audio lifecycle)"
  - "SPEECH_ENDED resolves even if it races ahead of the waiter setup"
