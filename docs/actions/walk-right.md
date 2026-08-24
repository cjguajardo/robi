# WALK_RIGHT

Espejo de [WALK_LEFT](./walk-left.md): rota el avatar a EAST y lo desplaza `+steps` bloques en X.

## TL;DR

Comando lateral derecho; dirección, audio, sprite y desplazamiento comienzan juntos.

## Flowchart

```mermaid
flowchart LR
    USER([👤 "camina a la derecha N pasos"]) -->|COMMAND| SVR

    subgraph SVR["🖥️ Server (server.ts)"]
        EXEC["EXECUTE → direction EAST + pendingMove"]
        BR["SAY audioUrl walk-right-01.mp3"]
        WAIT["waitForSpeechEnded"]
        APPLY["APPLY_MOVEMENT → position.x += steps"]
        COMP["COMPLETE → IDLE"]
        EXEC --> APPLY --> COMP
        EXEC --> BR --> WAIT --> COMP
    end

    SVR -->|SAY + WORLD_CHANGED ×2| DISP

    subgraph DISP["📺 Display (Robi.tsx)"]
        PLAY[playSay]
        START[play → SPEECH_STARTED]
        END[ended → SPEECH_ENDED]
        PLAY --> START --> END
    end

    DISP -->|SPEECH_ENDED| SVR
    END -.->|resolves| WAIT
```

**Leyenda**: 🟦 server · 🟩 display. Espejo de [WALK_LEFT](./walk-left.md) — direction EAST, `pendingMove.x = +steps`.

## Forma

```ts
{ type: "WALK_RIGHT"; steps: number }
```

`steps`: entero en `[1, 10]`.

## Disparador

### Parser local (`src/lib/robi/parser.ts:100`)

```ts
{ cmd: "WALK_RIGHT", test: /\b(camina a la derecha|ve a la derecha|hacia la derecha|derecha)\b/, withSteps: true }
```

### Post-check de TURN

Idéntico a WALK_LEFT: `gira`/`voltea` + lateral → `UNKNOWN`.

### LLM fallback, validación, `extractSteps`

Idénticos a [WALK_LEFT](./walk-left.md#disparador).

## Audio

- **Categoría**: `WALK_RIGHT`.
- **Archivos**: `public/audio/walk-right-01.mp3` (1 sola entrada).
- **Texto de muestra**: "¡A la derecha!"

## State machine

| T | Event | Reducer | Sprite |
|---|---|---|---|
| 0 | `EXECUTE {command: WALK_RIGHT, steps}` | `EXECUTING`, `direction = EAST`, `pendingMove = {x: +steps, y: 0}` | `walking` |
| 0 | `APPLY_MOVEMENT` + `SAY` | `EXECUTING`, `position.x += steps` | `walking` + audio |
| max(audio, move) | `COMPLETE` | `IDLE` | `idle` |

`actionAnimationMs(WALK_RIGHT) = max(400, steps * 350)` ms (idéntico a WALK_LEFT).

## Posición y dirección

### Dirección
Cambia INMEDIATAMENTE en EXECUTE. Avatar se voltea a EAST.

### Posición
INMEDIATO después de EXECUTE. `pendingMove = {x: +steps, y: 0}` se aplica antes de esperar el final del audio.

### WORLD_CHANGED
Dos broadcasts consecutivos: post-EXECUTE (direction nueva) y post-APPLY_MOVEMENT (position nueva), ambos antes del final del audio.

## Sprite track

Mismo track que WALK_LEFT (`walking`): 4 frames, 0.7s loop, `step-end`. Direction transform = `scaleX(1)` (sin flip; el sprite está drawn facing right cuando mira EAST).

## Edge cases, Diagnóstico, Puntos de tweak

Idénticos a [WALK_LEFT](./walk-left.md#edge-cases) — solo cambia la dirección y el signo de `pendingMove.x`.

## Dependencias

Todo igual a WALK_LEFT, excepto:
- `src/lib/robi/parser.ts:100` — regex
- `src/lib/robi/reducer.ts:143-149` — EXECUTE case
- `src/lib/robi/responses.ts:43` — categoryFor
- `sonidos/audios/walk-right-01.mp3`

## Tests

- `src/lib/robi/parser.test.ts`: equivalentes a WALK_LEFT
- `src/lib/robi/reducer.test.ts`: WALK_RIGHT case
- `src/lib/realtime/server.test.ts`:
  - "multi-step WALK_RIGHT queues the full translation in pendingMove"
