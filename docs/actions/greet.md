# GREET

Saludo. El niño dice "hola ROBI" / "buenos días"; el operador usa el botón "👋".

## TL;DR

Comando de acción con sprite de waving. Audio pregrabado, state `EXECUTING`, 1s de waving visible post-audio.

## Forma

```ts
{ type: "GREET" }
```

## Disparador

### Parser local (`src/lib/robi/parser.ts:83`)

```ts
{ cmd: "GREET", test: /\b(buenos dias|buenas|hola|saluda|saludar|como estas|que tal)\b/ }
```

**Importante**: `isQuestionIntent()` (`parser.ts:62-68`) filtra "que tal" y "como estas" porque son < 3 palabras. Así "como estas" → GREET, pero "como funciona un robot" → ANSWER_QUESTION.

## Audio

- **Categoría**: `GREET`.
- **Archivos**: `public/audio/greet-{01,02}.mp3` (2 entradas, rotación).
- **Texto de muestra**: "¡Hola! Soy ROBI." / "¡Hola! Qué bueno verlos."

## State machine

| T | Event | Reducer | Sprite |
|---|---|---|---|
| 0 | `EXECUTE {command: GREET}` | `EXECUTING` | `waving` |
| audio_end | `RETURN_TO_EXECUTION` (action) | `EXECUTING` | `waving` (sigue) |
| post-delay | `COMPLETE` | `IDLE` | `idle` |

`actionAnimationMs(GREET) = 1000` ms (1s de waving visible).

## Posición y dirección

No cambia. `pendingMove = null`.

## Flujo del servidor

Branch genérico.

## Sprite track (`src/components/display/sprites.ts:86`)

```ts
waving: { id: "waving", row: 2, startCol: 4, frameCount: 3, duration: 0.9 }
```

3 frames cyclando a 0.9s, `step-end`. La mano se agita mientras ROBI dice hola.

## Edge cases

- **GREET durante LISTENING**: el audio del saludo se broadcastea, el micro sigue captando. Si llega otra transcripción, queda en el buffer del parser hasta que termine el saludo.

## Diagnóstico de "ruido"

| Síntoma | Dónde mirar |
|---|---|
| "como funciona..." matchea GREET en lugar de ANSWER_QUESTION | `src/lib/robi/parser.ts:62-68` — `isQuestionIntent()` debe correr ANTES del pattern loop (línea 123). |
| Avatar no agita la mano | `src/components/display/sprites.ts:spriteTrackFor()` — case `EXECUTING` + `GREET` debe devolver `SPRITE_TRACKS.waving`. |
| Waving se corta antes de 1s | `src/lib/realtime/server.ts:isActionCommand()` — GREET debe estar en la lista (actualmente sí). Bug = falta. |
| Audio loop infinito | Una sola SAY → no debería pasar. Verificar `drainQueue` no entre en loop. |

## Puntos de tweak

| Querés cambiar... | Archivo:línea |
|---|---|
| Tiempo de waving visible | `src/lib/realtime/server.ts:actionAnimationMs()` case `GREET` (actualmente 1000ms) |
| Sprite del saludo | `src/components/display/sprites.ts:SPRITE_TRACKS.waving` |
| Textos de saludo | `sonidos/audios.json` + `pnpm audios` |
| Regex (palabras que disparan GREET) | `src/lib/robi/parser.ts:83` |
| Prioridad sobre ANSWER_QUESTION | `isQuestionIntent()` debe correr antes que el pattern GREET |

## Dependencias

- `src/types/robi.ts:17`
- `src/lib/robi/parser.ts:83` + `isQuestionIntent()` (línea 62)
- `src/lib/robi/reducer.ts:164-165`
- `src/lib/robi/responses.ts:46`
- `src/components/display/sprites.ts:86, 220`
- `src/lib/realtime/server.ts:isActionCommand()` (línea ~316)
- `sonidos/audios/greet-{01,02}.mp3`

## Tests

- `src/lib/robi/parser.test.ts`:
  - "parses 'hola robi' → GREET"
  - "filters short question phrases (que tal → GREET, que tal esto → ANSWER_QUESTION)"

No tiene test dedicated en `server.test.ts` — cubierto por el patrón genérico de action commands + audio catalog.
