# SAY_GOODBYE

Despedida. El niño dice "chau ROBI" / "adiós".

## TL;DR

Comando con un único SAY y sprite `waving` (reutilizado de GREET). 1s de waving visible post-audio.

## Flowchart

```mermaid
flowchart LR
    USER([👤 "chau ROBI"]) -->|COMMAND| SVR

    subgraph SVR["🖥️ Server (server.ts)"]
        EXEC["EXECUTE → EXECUTING"]
        BR["SAY audioUrl goodbye-NN.mp3"]
        WAIT["waitForSpeechEnded"]
        COMP["COMPLETE → IDLE"]
        EXEC --> BR --> WAIT --> COMP
    end

    SVR -->|SAY| DISP

    subgraph DISP["📺 Display"]
        PLAY[playSay]
        WAVE["waving sprite 1s visible (reutilizado de GREET)"]
        START[play → SPEECH_STARTED]
        END[ended → SPEECH_ENDED]
        PLAY --> START --> END
        END --> WAVE
    end

    DISP -->|SPEECH_ENDED| SVR
    END -.->|resolves| WAIT
```

**Leyenda**: 🟦 server · 🟩 display. Action command — sprite `waving` (compartido con GREET).

## Forma

```ts
{ type: "SAY_GOODBYE" }
```

## Disparador

### Parser local (`src/lib/robi/parser.ts:106`)

```ts
{ cmd: "SAY_GOODBYE", test: /\b(chau|adios|hasta luego|nos vemos|hasta pronto|bye)\b/ }
```

Sin acento en "adios" (normalizado).

## Audio

- **Categoría**: `SAY_GOODBYE`.
- **Archivos**: `public/audio/goodbye-{01,02}.mp3` (2 entries).
- **Texto de muestra**: "¡Chau chicos!" / "¡Hasta luego!"

## State machine

| T | Event | Reducer | Sprite |
|---|---|---|---|
| 0 | `EXECUTE {command: SAY_GOODBYE}` | `EXECUTING` | `waving` (reutilizado) |
| audio_end | `RETURN_TO_EXECUTION` (action) | `EXECUTING` | `waving` |
| post-delay | `COMPLETE` | `IDLE` | `idle` |

`actionAnimationMs(SAY_GOODBYE) = 1000` ms.

## Posición y dirección

No cambia. `pendingMove = null`.

## Flujo del servidor

Branch genérico (línea ~246).

## Sprite track (`src/components/display/sprites.ts:86`)

**Reutiliza `waving`** — mismo track que GREET. Decisión: ambos son saludos (uno de apertura, otro de cierre), mismo gesto físico.

## Edge cases

- **SAY_GOODBYE antes de PAUSED**: WAIT normal, IDLE post-audio.
- **GREET inmediatamente después de SAY_GOODBYE**: WAIT activo, queue normal.

## Diagnóstico

| Síntoma | Dónde mirar |
|---|---|
| Avatar no agita en despedida | `spriteTrackFor()` case `SAY_GOODBYE` debe devolver `waving` (línea 233). |
| "Hasta luego" matchea otra cosa | Verificar regex. |

## Puntos de tweak

| Querés cambiar... | Archivo:línea |
|---|---|
| Duración del waving | `src/lib/realtime/server.ts:actionAnimationMs()` case `SAY_GOODBYE` (1000ms) |
| Audio | `sonidos/audios.json` + `pnpm audios` |

## Dependencias

- `src/types/robi.ts:25`
- `src/lib/robi/parser.ts:106`
- `src/lib/robi/reducer.ts:180-186` (case content)
- `src/lib/robi/responses.ts:63`
- `src/components/display/sprites.ts:233`
- `src/lib/realtime/server.ts:isActionCommand()` (SAY_GOODBYE debe estar)
- `sonidos/audios/goodbye-{01,02}.mp3`

## Tests

Cubierto por el patrón genérico de action command.
