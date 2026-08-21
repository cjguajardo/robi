# CELEBRATE

Celebración. El niño dice "lo hicimos!" / "ROBI celebra"; el operador usa el botón "🎉".

## TL;DR

Único comando cuyo reducer lleva a un estado dedicado `CELEBRATING` (no `EXECUTING`). 1.5s de celebración visible post-audio.

## Flowchart

```mermaid
flowchart LR
    USER([👤 "lo hicimos!"]) -->|COMMAND| SVR

    subgraph SVR["🖥️ Server (server.ts)"]
        EXEC["EXECUTE → CELEBRATING (no EXECUTING)"]
        BR["SAY audioUrl celebrate-NN.mp3"]
        WAIT["waitForSpeechEnded"]
        COMP["COMPLETE → IDLE"]
        EXEC --> BR --> WAIT --> COMP
    end

    SVR -->|SAY| DISP

    subgraph DISP["📺 Display"]
        PLAY[playSay]
        C["celebrating sprite 1.5s visible"]
        START[play → SPEECH_STARTED]
        END[ended → SPEECH_ENDED]
        PLAY --> START --> END
        END --> C
    end

    DISP -->|SPEECH_ENDED| SVR
    END -.->|resolves| WAIT
```

**Leyenda**: 🟦 server · 🟩 display. CELEBRATE es el único comando cuyo EXECUTE lleva a un estado dedicado `CELEBRATING` (no `EXECUTING`).

## Forma

```ts
{ type: "CELEBRATE" }
```

## Disparador

### Parser local (`src/lib/robi/parser.ts:77`)

```ts
{ cmd: "CELEBRATE", test: /\b(celebrar|celebracion|lo logramos|mision cumplida|genial|excelente)\b/ }
```

**Es la PRIMERA entrada del PATTERNS** (deliberado): evita que "celebrar" matchee DANCE ("bailar"). Orden importa.

## Audio

- **Categoría**: `CELEBRATE`.
- **Archivos**: `public/audio/celebrate-{01,02}.mp3`.
- **Texto de muestra**: "¡Lo logramos!" / "¡Genial!"

## State machine

| T | Event | Reducer | Sprite |
|---|---|---|---|
| 0 | `EXECUTE {command: CELEBRATE}` | **`CELEBRATING`** (NO EXECUTING) | `celebrating` |
| audio_end | `RETURN_TO_EXECUTION` (action) | `CELEBRATING` (sin cambio, RETURN_TO_EXECUTION solo aplica si SPEAKING) | `celebrating` (sigue) |
| post-delay | `COMPLETE` | `IDLE` | `idle` |

`actionAnimationMs(CELEBRATE) = 1500` ms.

> **Detalle**: como el state es `CELEBRATING` (no `EXECUTING`), la transition `RETURN_TO_EXECUTION` desde SPEAKING no aplica (solo convierte SPEAKING → EXECUTING). El sprite sigue siendo `celebrating` desde que arranca.

## Posición y dirección

No cambia. `pendingMove = null`.

## Flujo del servidor

Branch genérico (línea ~246). La diferencia está en el reducer.

## Sprite track (`src/components/display/sprites.ts:90`)

```ts
celebrating: { id: "celebrating", row: 3, startCol: 6, frameCount: 4, duration: 0.5 }
```

4 frames cyclando a 0.5s. Celebración enérgica.

## Edge cases

- **CELEBRATE x2**: el segundo se rechaza (lock).
- **CELEBRATE en SAY_GOODBYE workflow**: usar DANCE para una celebración más larga, CELEBRATE para el cierre de misión.

## Diagnóstico de "ruido"

| Síntoma | Dónde mirar |
|---|---|
| Estado muestra EXECUTING en lugar de CELEBRATING | `src/lib/robi/reducer.ts:169-173` — case `CELEBRATE` debe llevar a `CELEBRATING`. |
| Celebración se corta al volver a sprite en EXECUTING | `RETURN_TO_EXECUTION` no se llama porque state nunca fue SPEAKING durante CELEBRATE. Es decir, funciona correctamente. |

## Puntos de tweak

| Querés cambiar... | Archivo:línea |
|---|---|
| Duración de celebración visible | `src/lib/realtime/server.ts:actionAnimationMs()` case `CELEBRATE` (1500ms) |
| Estado dedicado `CELEBRATING` | `src/types/robi.ts` (union `RobiState`) + `src/lib/robi/reducer.ts:169` |
| Sprite | `src/components/display/sprites.ts:SPRITE_TRACKS.celebrating` |
| Audio | `sonidos/audios.json` |
| Palabras clave (misión cumplida, genial, …) | `src/lib/robi/parser.ts:77` |

## Dependencias

- `src/types/robi.ts:19` + `RobiState` (CELEBRATING)
- `src/lib/robi/parser.ts:77` (PRIMERA entry)
- `src/lib/robi/reducer.ts:169-173`
- `src/lib/robi/responses.ts:48`
- `src/components/display/sprites.ts:90, 206`
- `sonidos/audios/celebrate-{01,02}.mp3`

## Tests

Cubierto por el patrón genérico. Si querés agregar: test que valide `state === "CELEBRATING"` después de EXECUTE.
