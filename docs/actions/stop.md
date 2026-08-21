# STOP

Detenerse. El niño dice "ROBI para"; el operador usa el botón de pausa. STOP va directo a IDLE (no pasa por EXECUTING).

## TL;DR

Único comando cuyo EXECUTE lleva directo a IDLE, sin pasar por EXECUTING. Refleja su semántica: "termina todo".

## Forma

```ts
{ type: "STOP" }
```

## Disparador

### Parser local (`src/lib/robi/parser.ts:89`)

```ts
{ cmd: "STOP", test: /\b(detente|para|alto|frena|stop)\b/ }
```

## Audio

- **Categoría**: `STOP`.
- **Archivos**: `public/audio/stop-{01,02}.mp3`.
- **Texto de muestra**: "¡Alto!" / "¡Detengo!"

## State machine

| T | Event | Reducer | Sprite |
|---|---|---|---|
| 0 | `EXECUTE {command: STOP}` | **IDLE** (directo, NO EXECUTING) | `idle` |
| audio_end | `THINK` (content) | THINKING | `idle` |
| post-audio | `COMPLETE` | IDLE | `idle` |

`actionAnimationMs(STOP) = 0` — STOP NO está en `isActionCommand()`, así que el reducer va directo a THINK post-audio sin visual delay adicional.

## Posición y dirección

No cambia. `pendingMove` se fuerza a `null` en `reducer.ts:163`.

## Flujo del servidor

Branch genérico (línea ~246), idéntico a la mayoría de comandos. Sin особенidad — la diferencia está en el reducer: `STOP` no produce estado EXECUTING.

```ts
case "STOP":
  return { ...world, state: "IDLE", pendingMove: null };
```

`src/lib/robi/reducer.ts:162-163`.

## Sprite track

Sprite = `idle` (porque el reducer ya está en IDLE). 1 frame, estático. Ver [references.md §3 Sprite system](../references.md#3-sprite-system).

## Edge cases

- **STOP durante command activo**: NO interrumpe el comando actual. STOP va a la queue y se procesa después del actual. Si querés interrupción inmediata, usá el emergency path (`ingestWorldEvent("PAUSE")`).
- **STOP durante PAUSED**: válido, simplemente re-emite IDLE. No-op útil.

## Diagnóstico de "ruido"

| Síntoma | Dónde mirar |
|---|---|
| Avatar no vuelve a IDLE después de STOP | `src/lib/robi/reducer.ts:162-163` — `state: "IDLE"` debe estar. |
| STOP bloquea la queue | Bug en `drainQueue`. STOP no debería lockear más que cualquier comando. |
| STOP es action command | `src/lib/realtime/server.ts:isActionCommand()` — STOP NO debe estar en la lista (actualmente NO está). Si alguien lo agrega, se rompe el flujo `THINK` post-audio. |

## Puntos de tweak

| Querés cambiar... | Archivo:línea |
|---|---|
| Comportamiento de "termina todo" inmediato (interrumpir comando actual) | Usar `ingestWorldEvent("PAUSE")` en lugar de STOP. STOP es para queue-friendly stop. |
| Audio | `sonidos/audios.json` + `pnpm audios` |
| Redirigir STOP a PAUSE | `src/lib/realtime/server.ts:ingestCommand()` — interceptar antes de `validateCommand`. |

## Dependencias

- `src/types/robi.ts:16` — type literal
- `src/lib/robi/parser.ts:89` — regex
- `src/lib/robi/reducer.ts:162-163` — EXECUTE (directo a IDLE)
- `src/lib/robi/responses.ts:45` — categoryFor
- `sonidos/audios/stop-{01,02}.mp3`

## Tests

Cubierto por tests genéricos (`server.test.ts` testea EXECUTING → IDLE para varios commands). No tiene test dedicated porque es el caso "más simple" — un SAY + drainQueue genérico.
