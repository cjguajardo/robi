# WALK_LEFT

Caminar a la izquierda: rota el avatar a WEST y (después del audio) lo desplaza `-steps` bloques en X.

## TL;DR

Comando de movimiento lateral izquierdo; direction WEST inmediata, position deferred hasta `APPLY_MOVEMENT` post-audio.

## Flowchart

```mermaid
flowchart LR
    USER([👤 "camina a la izquierda N pasos"]) -->|COMMAND| SVR

    subgraph SVR["🖥️ Server (server.ts)"]
        EXEC["EXECUTE → direction WEST + pendingMove"]
        BR["SAY audioUrl walk-left-01.mp3"]
        WAIT["waitForSpeechEnded"]
        APPLY["APPLY_MOVEMENT → position.x -= steps"]
        COMP["COMPLETE → IDLE"]
        EXEC --> BR --> WAIT --> APPLY --> COMP
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

**Leyenda**: 🟦 server node · 🟩 display node. Secuencia lineal (sin paralelismo en este comando). `APPLY_MOVEMENT` se ejecuta DESPUÉS de `SPEECH_ENDED` por eso el position update es deferred.

## Forma

```ts
{ type: "WALK_LEFT"; steps: number }
```

`steps`: entero en `[1, 5]`. Ver [references.md §6 Configuración](../references.md#6-configuracion).

## Disparador

### Parser local (`src/lib/robi/parser.ts:99`)

```ts
{ cmd: "WALK_LEFT", test: /\b(camina a la izquierda|ve a la izquierda|hacia la izquierda|izquierda)\b/, withSteps: true }
```

### Post-check de TURN

`src/lib/robi/parser.ts:131` — si el texto contiene `gira` o `voltea` Y matchea el regex de WALK_LEFT, se fuerza `UNKNOWN` (los turns fueron eliminados del producto).

### LLM fallback

`src/lib/llm/system-prompt.ts` puede devolver `WALK_LEFT` cuando el parser local devuelve `UNKNOWN`. Schema: `{type: "WALK_LEFT", steps: 1-5}`. Model: `gpt-4o-mini`.

### Validación

`src/lib/robi/validator.ts` — `clamp(steps, 1, 5)`. Inputs fuera de rango se clampean. Si steps ≤ 0 → 1.

### `extractSteps()` (`parser.ts:24-33`)

1. Busca `\b(\d{1,2})\b` → número entero.
2. Si no, busca palabras (`uno/un/una`=1, `dos`=2, …, `nueve`=9).
3. Si nada matchea → `defaultSteps` (= 1).

Si la frase dice "diez pasos" → `clamp(10, 1, 5)` = 5 (no se permite caminar 10).

## Audio

- **Categoría**: `WALK_LEFT` (`src/lib/robi/responses.ts:42`).
- **Archivos**: `public/audio/walk-left-01.mp3` (1 sola entrada).
- **Fuente**: `sonidos/audios/walk-left-01.mp3` (generado con `pnpm audios`).
- **Rotación**: counter siempre 0 (1 sola entry).
- **Texto de muestra**: "¡A la izquierda!" (de `sonidos/audios.json`).

## State machine

| T | Event | Reducer | Sprite |
|---|---|---|---|
| 0 | `EXECUTE {command: WALK_LEFT, steps}` | `EXECUTING`, `direction = WEST`, `pendingMove = {x: -steps, y: 0}` | `walking` (track) |
| audio_end | `RETURN_TO_EXECUTION` (action) | `EXECUTING` (sin cambio) | `walking` |
| audio_end | `APPLY_MOVEMENT` | `EXECUTING`, `position.x -= steps` | `walking` |
| post-delay | `COMPLETE` | `IDLE` | `idle` |

`actionAnimationMs(WALK_LEFT) = max(400, steps * 350)` ms.

## Posición y dirección

### Dirección
Cambia **INMEDIATAMENTE** en EXECUTE. Avatar se voltea a WEST antes de que termine el audio.

### Posición
Cambia **DIFERIDO**. Vectorizado en `pendingMove = {x: -steps, y: 0}`. Aplicado en `APPLY_MOVEMENT` post-audio.

**Por qué diferido**: el niño ve a ROBI decir "¡A la izquierda!" en el lugar, y LUEGO camina. Esto sincroniza el cue auditivo con la animación visible.

### WORLD_CHANGED

Se broadcastea **dos veces** por comando:
1. Post-EXECUTE (dirección nueva, position vieja).
2. Post-APPLY_MOVEMENT (dirección sin cambio, position nueva).

`src/lib/realtime/server.ts:159-166` (post-EXECUTE) y `src/lib/realtime/server.ts:268-277` (post-APPLY_MOVEMENT).

## Flujo del servidor (`drainQueue`)

Entra al branch genérico (línea ~246):

```ts
const phrase = responseForWithAudio(next);   // { text, audioUrl: '/audio/walk-left-01.mp3' }
const waiter = waitForSpeechEnded();
broadcast({ type: "SAY", payload: phrase }); // emit
await waiter;                                 // gate
if (state.world.pendingMove) {
  transition({ type: "APPLY_MOVEMENT" });
  broadcast({ type: "WORLD_CHANGED", payload: { position, direction } });
}
state.processing = false;
await sleep(actionAnimationMs(next));         // visual delay
transition({ type: "COMPLETE" });
```

## Sprite track (`src/components/display/sprites.ts:85`)

```
walking: { id: "walking", row: 2, startCol: 0, frameCount: 4, duration: 0.7 }
```

4 frames cyclando a 0.7s con timing `step-end`. El avatar camina hacia la izquierda (WEST transform vía `scaleX(-1)`).

## Edge cases

- **Multi-step walks**: animation total = `max(400, steps * 350)` ms. 3 pasos = 1050ms.
- **Salir del mundo**: NO hay verificación de boundaries (el mundo es open). El display clip-ea visualmente fuera de pantalla.
- **Dos WALK_LEFT consecutivos**: el segundo se rechaza (`state.processing` lock). Cliente recibe `{type: "STOP"}` y debe reintentar.
- **WALK_LEFT durante THINKING**: WAITER continúa normalmente; el reducer mantiene el command activo hasta SPEECH_ENDED.

## Diagnóstico de "ruido"

Si WALK_LEFT se comporta raro:

| Síntoma | Dónde mirar |
|---|---|
| Avatar camina hacia el lado equivocado | `src/lib/robi/reducer.ts:136-143` (case `WALK_LEFT`) — verifica que `direction: "WEST"` y `pendingMove.x = -steps`. También `src/components/display/sprites.ts:138` (DIRECTION_TRANSFORM.WEST). |
| La direction cambia pero la posición no | El display no está viendo el segundo `WORLD_CHANGED`. Verificar que `pendingMove` no se dropeó. Ver `src/lib/realtime/server.ts:268-277`. |
| Avatar camina antes de terminar el audio | Bug en `drainQueue` — el `APPLY_MOVEMENT` se está moviendo antes del `await waiter`. NO debería pasar, pero verificar el orden. |
| El visual delay es demasiado corto/largo | `src/lib/realtime/server.ts:actionAnimationMs()` — ajustar la fórmula `steps * 350`. |
| Steps > 5 aceptado | Validator: `src/lib/robi/validator.ts`. Schema no clampea correctamente. |
| Audio no suena | `public/audio/walk-left-01.mp3` no existe, o audios:install no se corrió. Ver `pnpm audios:install`. |

## Puntos de tweak

| Querés cambiar... | Archivo:línea | Notas |
|---|---|---|
| Velocidad de la animación visible | `src/lib/realtime/server.ts:actionAnimationMs()` → fórmula `Math.max(400, steps * 350)` | Constante 350ms por step; mínimo 400ms (1 step). |
| Cap de steps (1-5) | `src/lib/robi/config.server.ts` → `maxSteps` | Cambia acá, no hardcodear. |
| Steps default | `src/lib/robi/config.server.ts` → `defaultSteps` | Si la frase no menciona número. |
| Texto que dice | `sonidos/audios.json` (cambiar `text`) + regenerar con `pnpm audios` | El text en el código viene del catálogo cargado. |
| Audio URL | `sonidos/audios/walk-left-NN.mp3` + `pnpm audios:install` | Regenerar y copiar a `public/audio/`. |
| Sprite track | `src/components/display/sprites.ts:SPRITE_TRACKS.walking` | row/col/frameCount/duration. El cell `data-anim="walking"` lo activa. |
| Regex del parser | `src/lib/robi/parser.ts:99` | Patrón más específico arriba. |
| LLM prompt | `src/lib/llm/system-prompt.ts` | Schema fijo, ejemplos van acá. |

## Dependencias

- `src/types/robi.ts` — type literal
- `src/lib/robi/parser.ts:99` — regex
- `src/lib/robi/validator.ts` — clamp
- `src/lib/robi/reducer.ts:136-143` — EXECUTE case
- `src/lib/robi/responses.ts:42` — categoryFor
- `src/components/display/sprites.ts:85` — SPRITE_TRACKS.walking
- `src/components/display/sprites.ts:138` — DIRECTION_TRANSFORM.WEST
- `src/lib/realtime/server.ts:301` — actionAnimationMs
- `src/lib/realtime/server.ts:268` — APPLY_MOVEMENT (genérico)
- `sonidos/audios.json` — entrada del catálogo
- `public/audio/walk-left-01.mp3` — archivo servido

## Tests

- `src/lib/robi/parser.test.ts`:
  - "parses 'robi camina a la izquierda' → WALK_LEFT 1"
  - "extracts steps from digit words"
  - "rejects turn phrases (gira a la izquierda → UNKNOWN)"
- `src/lib/robi/reducer.test.ts`:
  - "WALK_LEFT sets state EXECUTING and pendingMove"
  - "APPLY_MOVEMENT shifts position by pendingMove"
- `src/lib/realtime/server.test.ts`:
  - "ingestCommand validates, queues, and broadcasts EXECUTING then IDLE" (con WALK_LEFT 1)
  - "WORLD_CHANGED broadcasts the new direction immediately, position unchanged (deferred)"
  - "WORLD_CHANGED broadcasts the new position a SECOND time, AFTER audio ends"
  - "WALK_LEFT rotates ROBI to WEST and queues translation as pendingMove (no eager position change)"
  - "SPEECH_ENDED unblocks drainQueue, releasing the queue lock"
  - "safety timer kicks in if SPEECH_ENDED never arrives"
