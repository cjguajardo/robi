# DANCE

Bailar. El niño dice "ROBI baila"; el operador usa el botón "🎵".

## TL;DR

Comando de acción con sprite `dancing`. Sin movimiento, 2s de baile visible.

## Flowchart

```mermaid
flowchart LR
    USER([👤 "ROBI baila"]) -->|COMMAND| SVR

    subgraph SVR["🖥️ Server (server.ts)"]
        EXEC["EXECUTE → EXECUTING"]
        BR["SAY audioUrl dance-NN.mp3"]
        WAIT["waitForSpeechEnded"]
        COMP["COMPLETE → IDLE"]
        EXEC --> BR --> WAIT --> COMP
    end

    SVR -->|SAY| DISP

    subgraph DISP["📺 Display"]
        PLAY[playSay]
        DANCING["dancing sprite 2s visible"]
        START[play → SPEECH_STARTED]
        END[ended → SPEECH_ENDED]
        PLAY --> START --> END
        END --> DANCING
    end

    DISP -->|SPEECH_ENDED| SVR
    END -.->|resolves| WAIT
```

**Leyenda**: 🟦 server · 🟩 display. Action command — sprite `dancing` 2s post-audio.

## Forma

```ts
{ type: "DANCE" }
```

## Disparador

### Parser local (`src/lib/robi/parser.ts:80`)

```ts
{ cmd: "DANCE", test: /\b(baila|baile|bailar)\b/ }
```

> **Orden en PATTERNS**: DANCE está DESPUÉS de CELEBRATE pero ANTES de GREET. Esto previene que "celebración" matche DANCE (regla del parser: patrones más específicos primero).

## Audio

- **Categoría**: `DANCE`.
- **Archivos**: `public/audio/dance-{01,02}.mp3`.
- **Texto de muestra**: "¡A bailar!" / "¡Mira cómo bailo!"

## State machine

| T | Event | Reducer | Sprite |
|---|---|---|---|
| 0 | `EXECUTE {command: DANCE}` | `EXECUTING` | `dancing` |
| audio_end | `RETURN_TO_EXECUTION` (action) | `EXECUTING` | `dancing` (sigue) |
| post-delay | `COMPLETE` | `IDLE` | `idle` |

`actionAnimationMs(DANCE) = 2000` ms (2s de baile).

## Posición y dirección

No cambia. `pendingMove = null`.

## Flujo del servidor

Branch genérico.

## Sprite track (`src/components/display/sprites.ts:89`)

```ts
dancing: { id: "dancing", row: 3, startCol: 0, frameCount: 6, duration: 0.55 }
```

6 frames cyclando a 0.55s. El frame más rápido del catálogo — kid-friendly fast loop.

## Edge cases

- **DANCE x2 rápido**: el segundo se rechaza (cola lock).

## Diagnóstico de "ruijo"

| Síntoma | Dónde mirar |
|---|---|
| Baile cortado a 1s en lugar de 2s | `src/lib/realtime/server.ts:actionAnimationMs()` — case `DANCE` debe ser 2000. |
| Avatar baila lento | `src/components/display/sprites.ts:SPRITE_TRACKS.dancing.duration` (actualmente 0.55s). |
| "celebración" matchea DANCE | Bug del parser — orden de PATTERNS. CELEBRATE debe ir antes que DANCE. |

## Puntos de tweak

| Querés cambiar... | Archivo:línea |
|---|---|
| Duración del baile | `src/lib/realtime/server.ts:actionAnimationMs()` case `DANCE` (2000ms) |
| Velocidad del sprite | `src/components/display/sprites.ts:SPRITE_TRACKS.dancing.duration` |
| Audio | `sonidos/audios.json` |

## Dependencias

- `src/types/robi.ts:18`
- `src/lib/robi/parser.ts:80`
- `src/lib/robi/reducer.ts:166-167`
- `src/lib/robi/responses.ts:47`
- `src/components/display/sprites.ts:89`
- `sonidos/audios/dance-{01,02}.mp3`

## Tests

Cubierto por el patrón genérico. No tiene test dedicated.
