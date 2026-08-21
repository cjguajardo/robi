# ACTIONS.md — Flujo por comando

Documenta el flujo completo de cada `RobiCommand` desde que el niño habla hasta
que el avatar termina la acción. Para cada comando se describe:

- **Disparador** — cómo lo detecta el parser (regex o LLM fallback).
- **Forma del comando** — tipo TypeScript exacto.
- **Audio** — categoría del catálogo, formato de archivo.
- **Estado / sprite** — transición del reducer y track de animación.
- **Posición / dirección** — si cambia la ubicación o el facing del avatar.
- **Flujo del servidor** — qué hace `drainQueue()` en este caso.
- **Animación visible** — duración que el avatar sigue en pantalla.
- **Tests** — dónde está cubierto.

> **Convenciones de lectura de este doc:**
> - `T=0` = momento en que el comando entra a `drainQueue()`.
> - "Display" = la vista `/display` (proyector); "Control" = `/control` (teléfono).
> - "Catálogo" = `sonidos/audios.json` → `src/lib/robi/audio-catalog.ts`.

---

## Índice

| Comando | Tipo | Movimiento | LLM | Preámbulo | TTS dinámico |
|---|---|---|---|---|---|
| `WALK_LEFT` / `WALK_RIGHT` | lateral | sí (1-5 bloques) | no | no | no |
| `JUMP` | acción | no (in-place) | no | no | no |
| `STOP` | acción | no | no | no | no |
| `GREET` | acción | no | no | no | no |
| `DANCE` | acción | no | no | no | no |
| `CELEBRATE` | acción | no | no | no | no |
| `RESET` | evento | sí (vuelve al origen) | no | no | sí (`/api/tts`) |
| `TELL_JOKE` | contenido | no | no | sí | no |
| `TELL_RIDDLE` | contenido | no | no | sí | no |
| `TELL_FACT` | contenido | no | no | sí | no |
| `SAY_GOODBYE` | contenido | no | no | no | no |
| `ANSWER_QUESTION` | contenido | no | **sí** | **sí** | **sí (data URL)** |
| `UNKNOWN` | fallback | no | no | no | no |

---

## WALK_LEFT / WALK_RIGHT

Caminar lateralmente. El niño dice "camina a la izquierda" / "ROBI ve a la derecha tres pasos"; el operador también lo dispara con la cruceta del `/control`.

### Disparador

- **Parser local** (`src/lib/robi/parser.ts:99-100`):
  - WALK_LEFT → `/\b(camina a la izquierda|ve a la izquierda|hacia la izquierda|izquierda)\b/`
  - WALK_RIGHT → `/\b(camina a la derecha|ve a la derecha|hacia la derecha|derecha)\b/`
- **Post-check**: si la frase contiene `gira` o `voltea` (verbos de giro eliminados), se fuerza `UNKNOWN` en lugar de caminar.
- **LLM fallback**: el system prompt (`src/lib/llm/system-prompt.ts`) también puede devolver estos tipos si la transcripción es ambigua.

### Forma

```ts
{ type: "WALK_LEFT"; steps: number }
{ type: "WALK_RIGHT"; steps: number }
```

`steps` se extrae con `extractSteps()`:
- Dígitos: `\b(\d{1,2})\b` → número entero.
- Palabras: mapeo `NUMBER_WORDS` (`uno`/`un`/`una`=1, `dos`=2, …, `cinco`=5).
- Si no hay número → `defaultSteps` (1).
- Cap por `maxSteps` (5) en el validator.

### Audio

- Categoría: `WALK_LEFT` o `WALK_RIGHT` (un único audio pre-generado por categoría).
- Archivo: `public/audio/walk-left-01.mp3` / `walk-right-01.mp3`.
- Sin preámbulo. Una sola emisión `SAY`.
- Texto de muestra (del catálogo): "¡A la izquierda!" / "¡A la derecha!"

### Estado / sprite

| Paso | Reducer | Sprite |
|---|---|---|
| T=0 | `EXECUTE` → `EXECUTING`, dirección `WEST`/`EAST`, `pendingMove = {x: ±steps, y: 0}` | `walking` (track `walking`) |
| T=audio_end | reducer sin cambio (el SPEECH_ENDED dispara `RETURN_TO_EXECUTION` solo para acciones, ver nota) | `walking` (sigue) |
| T=audio_end + post-delay | `APPLY_MOVEMENT` → aplica `pendingMove`, position cambia | `walking` |
| T=audio_end + post-delay + COMPLETE | `COMPLETE` → `IDLE` | `idle` |

> Nota: `WALK_LEFT` y `WALK_RIGHT` están clasificados como **action commands**
> en `isActionCommand()` (`server.ts:291`), por lo que `SPEECH_ENDED` ejecuta
> `RETURN_TO_EXECUTION` (sprite sigue caminando) en lugar de `THINK`.

### Posición / dirección

- **Dirección**: cambia INMEDIATAMENTE en `EXECUTE` (ROBI se voltea antes de moverse).
- **Posición**: cambia DIFERIDO. El `EXECUTE` guarda el vector en `pendingMove`; el `APPLY_MOVEMENT` (después de que el audio termina) lo suma a `position`. Esto hace que el niño vea a ROBI decir "¡A la izquierda!" en el lugar y LUEGO caminar hacia el destino.

### Flujo del servidor

1. `drainQueue()` entra al `else` genérico (línea ~211).
2. `phrase = responseForWithAudio(command)` → `{ text, audioUrl: /audio/walk-{dir}-01.mp3 }`.
3. `waiter = waitForSpeechEnded()` (safety timer 8s).
4. `broadcast({ type: "SAY", payload: phrase })`.
5. `await waiter`.
6. Si `pendingMove` → `APPLY_MOVEMENT` + `broadcast(WORLD_CHANGED)`.
7. `state.processing = false`; `visualDelayMs = max(400, steps * 350)` ms; sleep.
8. `transition({COMPLETE})`.

### Animación visible

`actionAnimationMs()` retorna `Math.max(400, steps * 350)`. Para 1 paso: 400ms. Para 5 pasos: 1750ms.

### Tests

- `server.test.ts`:
  - "ingestCommand validates, queues, and broadcasts EXECUTING then IDLE" (WALK_LEFT 1)
  - "SPEECH_ENDED unblocks drainQueue, releasing the queue lock"
  - "safety timer kicks in if SPEECH_ENDED never arrives"
  - "WORLD_CHANGED broadcasts the new direction immediately, position unchanged (deferred)"
  - "WORLD_CHANGED broadcasts the new position a SECOND time, AFTER audio ends"
  - "WALK_LEFT rotates ROBI to WEST and queues translation as pendingMove (no eager position change)"
  - "multi-step WALK_RIGHT queues the full translation in pendingMove"
- `reducer.test.ts`: cubre los cases `WALK_LEFT` y `WALK_RIGHT` de la switch.

---

## JUMP

Salto vertical en el lugar. El niño dice "ROBI salta"; el operador usa el botón "arriba" del dpad.

### Disparador

- **Parser local** (`parser.ts:92`): `/\b(salta|saltar|salto|brinca|brincar|brinco)\b/`.
- Sin steps: JUMP siempre es 1 bloque (kid-game semantics; el botón arriba es "salta uno", no selector de cantidad).

### Forma

```ts
{ type: "JUMP" }
```

### Audio

- Categoría: `JUMP` (un único audio).
- Archivo: `public/audio/jump-{01,02}.mp3`.
- Sin preámbulo.

### Estado / sprite

| Paso | Reducer | Sprite |
|---|---|---|
| T=0 | `EXECUTE` → `EXECUTING`, `pendingMove = null` | `jumping` (row 0, cells 0-2 con `[0,1,1,2,2,0]`) |
| T=audio_end | `RETURN_TO_EXECUTION` (action command) | `jumping` (sigue, animación continúa) |
| T=audio_end + 700ms | `COMPLETE` → `IDLE` | `idle` |

La traslación vertical viene del **CSS** `@keyframes avatar-jump` (no del reducer). El componente `RobiAvatar` recibe `jumpKey` que se incrementa en cada JUMP → fuerza un remount del `avatar-wrap` para que la animación CSS reinicie. El keyframe de 6 segmentos está alineado con el weighted sequence del sprite.

### Posición / dirección

- **Posición**: NO cambia. `pendingMove = null` en EXECUTE. La decisión de diseño: JUMP siempre es in-place, sin avance lateral, sin importar la dirección actual.
- **Dirección**: NO cambia.

### Flujo del servidor

Idéntico al genérico (línea 211). Como `pendingMove` es null, no se dispatcha `APPLY_MOVEMENT` y no hay segundo `WORLD_CHANGED`.

### Animación visible

`actionAnimationMs()` retorna `700` (un hop up-and-back-down).

### Tests

- `server.test.ts`:
  - "JUMP is in-place (no position change) and broadcasts EXECUTING → IDLE"
  - "SPEECH_STARTED drives the state to SPEAKING (mouth moving)"
  - "SPEECH_ENDED drives action commands back to EXECUTING (action sprite)"
- `reducer.test.ts`: cubre el case `JUMP`.

---

## STOP

Detener. El niño dice "ROBI para"; el operador usa el botón de pausa del dpad o el control manual.

### Disparador

- **Parser local** (`parser.ts:89`): `/\b(detente|para|alto|frena|stop)\b/`.

### Forma

```ts
{ type: "STOP" }
```

### Audio

- Categoría: `STOP` (un único audio pre-generado, texto corto).
- Archivo: `public/audio/stop-{01,02}.mp3`.

### Estado / sprite

| Paso | Reducer | Sprite |
|---|---|---|
| T=0 | `EXECUTE` → `IDLE` directo (no pasa por EXECUTING) | `idle` |

STOP es el ÚNICO comando cuyo EXECUTE **no** lleva a EXECUTING — va directo a IDLE. Esto refleja su semántica: es el comando "termina todo".

### Posición / dirección

No cambia.

### Flujo del servidor

Genérico (línea 211). Como `pendingMove` es null (STOP fuerza `pendingMove: null` en el reducer), no hay `APPLY_MOVEMENT`.

### Animación visible

`actionAnimationMs()` retorna `0` (STOP es comando "content" según `isActionCommand()` — NO devuelve true, así que el visualDelay es 0). Tras SPEECH_ENDED el reducer vuelve a `THINK` brevemente, luego `COMPLETE` → `IDLE`.

### Tests

- Cubierto por los tests genéricos del drainQueue (cualquier comando content).

---

## GREET

Saludo. El niño dice "hola ROBI" / "buenos días"; el operador usa el botón "👋" del control.

### Disparador

- **Parser local** (`parser.ts:83`): `/\b(buenos dias|buenas|hola|saluda|saludar|como estas|que tal)\b/`.
- `isQuestionIntent()` **excluye** "que tal" y "como estas" porque son < 3 palabras.

### Forma

```ts
{ type: "GREET" }
```

### Audio

- Categoría: `GREET` (2 audios pre-generados, rotación).
- Archivo: `public/audio/greet-{01,02}.mp3`.

### Estado / sprite

| Paso | Reducer | Sprite |
|---|---|---|
| T=0 | `EXECUTE` → `EXECUTING` | `waving` (track, 3 frames, 0.9s loop) |
| T=audio_end | `RETURN_TO_EXECUTION` (action command) | `waving` (sigue) |
| T=audio_end + 1000ms | `COMPLETE` → `IDLE` | `idle` |

### Posición / dirección

No cambia.

### Animación visible

`actionAnimationMs()` retorna `1000` (1s de waving antes de pasar a IDLE).

---

## DANCE

Baile. El niño dice "ROBI baila"; el operador usa el botón "🎵".

### Disparador

- **Parser local** (`parser.ts:80`): `/\b(baila|baile|bailar)\b/`.

### Forma

```ts
{ type: "DANCE" }
```

### Audio

- Categoría: `DANCE` (2 audios).
- Archivo: `public/audio/dance-{01,02}.mp3`.

### Estado / sprite

| Paso | Reducer | Sprite |
|---|---|---|
| T=0 | `EXECUTE` → `EXECUTING` | `dancing` (track, 6 frames, 0.55s loop) |
| T=audio_end | `RETURN_TO_EXECUTION` | `dancing` (sigue) |
| T=audio_end + 2000ms | `COMPLETE` → `IDLE` | `idle` |

### Posición / dirección

No cambia.

### Animación visible

`actionAnimationMs()` retorna `2000` (2s de baile).

---

## CELEBRATE

Celebración. El niño dice "lo hicimos!" / "ROBI celebra"; el operador usa el botón "🎉".

### Disparador

- **Parser local** (`parser.ts:77`): `/\b(celebrar|celebracion|lo logramos|mision cumplida|genial|excelente)\b/`. **Es la primera entrada del PATTERNS** para evitar conflicto con "saluda" (GREET).

### Forma

```ts
{ type: "CELEBRATE" }
```

### Audio

- Categoría: `CELEBRATE` (2 audios).
- Archivo: `public/audio/celebrate-{01,02}.mp3`.

### Estado / sprite

| Paso | Reducer | Sprite |
|---|---|---|
| T=0 | `EXECUTE` → `CELEBRATING` (NO `EXECUTING` — estado dedicado) | `celebrating` (track, 4 frames, 0.5s loop) |
| T=audio_end | `RETURN_TO_EXECUTION` (action command) | `celebrating` (sigue) |
| T=audio_end + 1500ms | `COMPLETE` → `IDLE` | `idle` |

### Posición / dirección

No cambia.

### Animación visible

`actionAnimationMs()` retorna `1500`.

---

## RESET

Volver al inicio. El niño dice "ROBI vuelve al inicio"; el operador usa el botón "🏠" o el botón de emergencia.

### Disparador

- **Parser local** (`parser.ts:86`): `/\b(reiniciar|reset|inicio|vuelve a empezar|comienza de nuevo|empieza de nuevo)\b/`.
- También se puede disparar manualmente vía `ingestWorldEvent("RESET")` desde `/control` (botón de emergencia).

### Forma

```ts
{ type: "RESET" }  // vía comando
// o
ingestWorldEvent("RESET")  // vía control directo
```

### Audio

**Sin audio pre-generado.** El texto es un literal: `"Vuelvo al inicio."` (`dynamicFallback()` en `responses.ts`). El cliente lo manda a `/api/tts` para sintetizar (con LRU cache, así que si se llama varias veces en una sesión es gratis).

### Estado / sprite

**Vía comando** (`{type: "RESET"}`):

| Paso | Reducer | Sprite |
|---|---|---|
| T=0 | `EXECUTE` → `IDLE`, position `{0,0}`, direction `SOUTH` (vía `initialWorld`) | `idle` |
| T=audio_end | `COMPLETE` → `IDLE` (sin cambio) | `idle` |

**Vía evento** (`ingestWorldEvent("RESET")`):

```
state.queue = []
state.processing = false
state.world = { ...initialWorld, state: "IDLE" }
broadcast({ type: "RESET" })
broadcast({ type: "STATE_CHANGED", payload: "IDLE" })
```

El evento ignora el audio y la cola. Corta cualquier cosa que estuviera sonando (`stopAudio()` en el display) y resetea la posición instantáneamente. **Esto es la acción de emergencia.**

### Posición / dirección

- **Sí cambia**, vuelve al origen `{0, 0}` dirección `SOUTH`.

### Flujo del servidor (vía comando)

Genérico (línea 211). Como RESET mapea a `category = null` en `categoryFor()`, devuelve `dynamicFallback("RESET") = "Vuelvo al inicio."` sin audioUrl. El cliente sintetiza con `/api/tts`.

### Tests

- `server.test.ts`: "RESET clears state and broadcasts".

---

## TELL_JOKE / TELL_RIDDLE / TELL_FACT

Contenido pre-grabado. El niño dice "cuenta un chiste" / "dame una adivinanza" / "sabías que…".

Comparten la mismo flujo porque usan la misma estructura `preamble + content`.

### Disparador

- **Parser local** (`parser.ts:103-105`):
  - TELL_JOKE: `/\b(chiste|chistes|contame un chiste|cuenta un chiste|hazme reir|gracioso|graciosa)\b/`
  - TELL_RIDDLE: `/\b(adivinanza|adivinanzas|acertijo|acertijos|dame una adivinanza)\b/`
  - TELL_FACT: `/\b(dato|dato curioso|sabias que|curiosidad|cuento algo)\b/`

### Forma

```ts
{ type: "TELL_JOKE" }
{ type: "TELL_RIDDLE" }
{ type: "TELL_FACT" }
```

### Audio (preámbulo + contenido)

Dos SAYs por comando, con gap fijo de 1.2s entre ellos.

| Comando | Preámbulo (categoría) | Contenido (categoría) | Archivo contenido |
|---|---|---|---|
| TELL_JOKE | `TELL_JOKE_PREAMBLE` | `JOKE` | `public/audio/joke-{01..07}.mp3` |
| TELL_RIDDLE | `TELL_RIDDLE_PREAMBLE` | `RIDDLE` | `public/audio/riddle-{01..05}.mp3` |
| TELL_FACT | `TELL_FACT_PREAMBLE` | `FACT` | `public/audio/fact-{01..05}.mp3` |

Rotación independiente por categoría (counter separado en `audio-catalog.ts`). El preámbulo fija la expectativa ("¿Quieren escuchar un chiste?") y el gap de 1.2s simula la pausa del narrador antes del punchline.

> **Degradación elegante**: si el catálogo no tiene entradas para la categoría
> de preámbulo, se omite y solo suena el contenido. El código usa
> `tryPick("…_PREAMBLE")` que devuelve `null` si está vacío.

### Estado / sprite

| Paso | Reducer | Sprite |
|---|---|---|
| T=0 | `EXECUTE` → `EXECUTING` | según command (ver abajo) |
| T=preámbulo_end (≈1-2s) | sin cambio | sigue |
| T=gap 1200ms | sin cambio | sigue |
| T=contenido_end | `THINK` (content command) | sigue |
| T=contenido_end + breve | `COMPLETE` → `IDLE` | `idle` |

Sprite por command (mapping en `sprites.ts:spriteTrackFor`):
- TELL_JOKE / TELL_FACT → `speaking` (mouth moving)
- TELL_RIDDLE → `thinking` (hand on chin)

### Posición / dirección

No cambia.

### Flujo del servidor (rama dedicada en `drainQueue()`, línea ~185)

```
const kind = ...  // "joke" | "riddle" | "fact"
const preamble = contentPreambleResponse(kind)
if (preamble) {
  broadcast({ type: "SAY", payload: preamble })  // sin waiter
  await sleep(PREAMBLE_TO_CONTENT_DELAY_MS)       // 1200ms
}
const phrase = responseForWithAudio(next)
const waiter = waitForSpeechEnded()
broadcast({ type: "SAY", payload: phrase })       // waiter cubre ESTE audio
await waiter
```

El waiter se monta **después** del preámbulo, así el `SPEECH_ENDED` del preámbulo no resuelve al waiter equivocado. Esto está documentado como gotcha en AGENTS.md — "no agregar waiter para el preámbulo".

### Animación visible

`actionAnimationMs()` retorna `0` (content command). `COMPLETE` inmediato tras SPEECH_ENDED del contenido.

### Tests

- `server.test.ts`:
  - "TELL_JOKE broadcasts SAY: preamble then joke (after audio lifecycle)"
  - "TELL_RIDDLE broadcasts a riddle-preamble then the riddle"
  - "TELL_FACT broadcasts a fact-preamble then the fact"

---

## SAY_GOODBYE

Despedida. El niño dice "chau ROBI" / "adiós".

### Disparador

- **Parser local** (`parser.ts:106`): `/\b(chau|adios|hasta luego|nos vemos|hasta pronto|bye)\b/`.

### Forma

```ts
{ type: "SAY_GOODBYE" }
```

### Audio

- Categoría: `SAY_GOODBYE` (2 audios).
- Archivo: `public/audio/goodbye-{01,02}.mp3`.
- Sin preámbulo (una sola SAY).

### Estado / sprite

| Paso | Reducer | Sprite |
|---|---|---|
| T=0 | `EXECUTE` → `EXECUTING` | `waving` (reutiliza el track de GREET) |
| T=audio_end | `THINK` (content command) | `waving` (sigue brevemente) |
| T=audio_end + 1000ms | `COMPLETE` → `IDLE` | `idle` |

### Posición / dirección

No cambia.

### Animación visible

`actionAnimationMs()` retorna `1000` (1s de waving).

> Nota: aunque SAY_GOODBYE está en `EXECUTING` y reutiliza el sprite `waving`,
> su `actionAnimationMs` es 1000 ms — está marcado como **action command** en
> `isActionCommand()`. Comparte el flujo visual con GREET.

---

## ANSWER_QUESTION ⭐

Respuesta a pregunta abierta. **EL único comando que toca LLM y TTS en tiempo
de ejecución.** Documentado extensivamente en `AGENTS.md §ANSWER_QUESTION flow`.
`Esta sección es el resumen.

### Disparador

- **Parser local** (`parser.ts:62-68`): `isQuestionIntent()`:
  1. Contiene `¿` o `?` en el texto crudo (señal fuerte).
  2. O empieza con `que|por que|porque|cual|como|donde|cuando|quien` **y** tiene ≥3 palabras.
- **Pre-check**: se ejecuta ANTES del pattern loop, así no es shadowed por e.g. `sabias que` (TELL_FACT).
- **LLM fallback**: el system prompt también devuelve `ANSWER_QUESTION` cuando el parser local devuelve `UNKNOWN` y la frase parece pregunta.

### Forma

```ts
{ type: "ANSWER_QUESTION"; question: string }
```

`question` es la transcripción normalizada (sin acentos, sin `¿`/`?`).

### Audio (preámbulo + respuesta con TTS dinámico)

Dos SAYs:

| # | Fuente | Categoría/Provider | Archivo o formato |
|---|---|---|---|
| 1 | Preámbulo | `ANSWER_QUESTION_PREAMBLE` (catálogo) | `public/audio/question-preamble-01.mp3` |
| 2 | Respuesta | `synthesizeSpeech(text)` (OpenAI TTS) | `data:audio/mpeg;base64,…` inline en el WS |

> **Fallback en cascada** (degradación elegante, ver AGENTS.md):
> - Sin `OPENAI_API_KEY` → respuesta = `ANSWER_QUESTION_FALLBACK` del catálogo (audio pre-grabado).
> - LLM timeout (>15s) → fallback del catálogo.
> - TTS falla → text-only; el cliente hace `/api/tts` como segunda red de seguridad.

### Pipeline (T-order)

```
T=0    fork:  broadcast SAY(preamble)        ┐ en paralelo
             LLM.call(question)               ┘

T=L    LLM returns answer text
       │
T=L+T  synthesizeSpeech(answerText) → mp3 buffer
       │
T=L+T+T  broadcast SAY({text, audioUrl: data:…mp3})
       │
T=L+T+T+X  client audio ends → SPEECH_ENDED → drainQueue resumes
```

La única paralelización es en T=0; LLM → TTS → broadcast es estrictamente
secuencial (necesitamos el texto antes de sintetizar y broadcastear).

### Estado / sprite

| Paso | Reducer | Sprite |
|---|---|---|
| T=0 | `EXECUTE` → `EXECUTING` | `thinking` (hand on chin, espera al LLM) |
| T=preámbulo_start | `SPEAK` → `SPEAKING` (display ve SAY) | `speaking` (sprite override) |
| T=preámbulo_end | `THINK` (content command) | `thinking` |
| T=respuesta_start | `SPEAK` → `SPEAKING` | `speaking` |
| T=respuesta_end | `THINK` | `thinking` |
| T=respuesta_end + breve | `COMPLETE` → `IDLE` | `idle` |

> **Nota del reducer vs sprite**: el reducer mantiene `THINKING` entre SAYs
> (percepción: ROBI "piensa"). Pero el sprite override es `SPEAKING` durante
> cualquier audio (`<audio>.play` → `SPEAK` reducer → SPRITE = SPEAKING).

### Posición / dirección

No cambia.

### Flujo del servidor (rama dedicada en `drainQueue()`, línea ~165)

```
const apiKey = process.env.OPENAI_API_KEY
const llmPromise = answerQuestion(next.question, apiKey)  // T=0 fork

const preamble = questionPreambleResponse()
if (preamble) broadcast({ type: "SAY", payload: preamble })  // sin waiter

const answer = await llmPromise  // T=L
const answerWithAudio = answer.audioUrl
  ? answer  // fallback: audioUrl del catálogo, no sintetizar
  : await synthesizeAnswerAudio(answer.text).then(...) // T=L+T

const waiter = waitForSpeechEnded()
broadcast({ type: "SAY", payload: answerWithAudio })  // T=L+T+T
await waiter
```

### Animación visible

`actionAnimationMs()` retorna `0` (content command). Sin delay adicional post-audio.

### Tests

- `server.test.ts`:
  - "ANSWER_QUESTION without an API key falls back to a friendly SAY" (sin API key → fallback del catálogo)
  - "ANSWER_QUESTION preamble is broadcast immediately (don't wait for LLM)" (timing)
  - "ANSWER_QUESTION bundles the LLM answer as a data:audio/mpeg URL" (camino feliz con mocks)

---

## UNKNOWN

Fallback cuando nada matchea. Se muestra cara confundida y un mensaje genérico.

### Disparador

- **Parser local**: retorna `{type: "UNKNOWN", raw}` cuando:
  - El texto normalizado queda vacío.
  - Ningún pattern del `PATTERNS` matchea.
  - El texto contiene `gira`/`voltea` con dirección lateral (turns eliminados).
- **LLM fallback**: si `llmFallbackEnabled` y el parser local devuelve `UNKNOWN`, se llama `/api/interpret` con el LLM (`gpt-4o-mini`) que devuelve un comando tipado. Si el LLM tampoco matchea → `UNKNOWN`.

### Forma

```ts
{ type: "UNKNOWN"; raw?: string }
```

`raw` es el texto original de la transcripción (para debug en `/control`).

### Audio

- Categoría: `UNKNOWN` (2 audios).
- Archivo: `public/audio/unknown-{01,02}.mp3`.
- Sin preámbulo.

### Estado / sprite

| Paso | Reducer | Sprite |
|---|---|---|
| T=0 | `EXECUTE` → **`CONFUSED`** (NO `EXECUTING`) | `confused` (track, 2 frames, 0.6s loop) |
| T=audio_end | `THINK` (content command) | `confused` (sigue) |
| T=audio_end + breve | `COMPLETE` → `IDLE` | `idle` |

> **Diferencia clave con otros comandos**: UNKNOWN salta directo a `CONFUSED`
> en el reducer (no pasa por `EXECUTING`). Es la única ruta a ese estado
> además de un error explícito.

### Posición / dirección

No cambia.

### Animación visible

`actionAnimationMs()` retorna `0` (content command).

### Tests

- `server.test.ts`: "UNKNOWN command moves state to CONFUSED".
- `reducer.test.ts`: cubre el case `UNKNOWN`.

---

## Glosario de estados

| Estado | Cuándo | Sprite por defecto |
|---|---|---|
| `SLEEPING` | Al inicio. El operador lo despierta con "ROBI" o botón. | `sleeping` |
| `IDLE` | Reposo entre acciones. Estado terminal de cada comando. | `idle` |
| `LISTENING` | Mientras el micrófono captura audio. | `listening` |
| `THINKING` | Entre SAYs en comandos de contenido, o mientras el LLM piensa. | `thinking` |
| `SPEAKING` | Mientras `<audio>.play` está corriendo (cualquier SAY). | `speaking` |
| `EXECUTING` | Mientras un comando activo se ejecuta (antes de `COMPLETE`). | depende del command |
| `CELEBRATING` | Solo durante `CELEBRATE`. | `celebrating` |
| `CONFUSED` | Solo cuando `UNKNOWN` matchea. | `confused` |
| `PAUSED` | Botón de emergencia. Congela todo. | `paused` (= `sleeping` track) |

## Cómo agregar un comando nuevo

Checklist mínima para `RobiCommandType = "NUEVO"`:

1. **`src/types/robi.ts`** — agregar el case al union `RobiCommand`.
2. **`src/lib/robi/parser.ts`** — agregar regex al `PATTERNS` (o lógica especial).
3. **`src/lib/robi/validator.ts`** — confirmar que pasa la validación (o agregar schema si lleva campos).
4. **`src/lib/robi/reducer.ts`** — agregar case en `EXECUTE` (transición de estado + pendingMove).
5. **`src/lib/robi/responses.ts`** — agregar case en `categoryFor()` con su categoría del catálogo (o `null` si usa TTS).
6. **`sonidos/audios.json`** — agregar las frases con su `filename` y `category`.
7. **`src/components/display/sprites.ts`** — agregar track a `SPRITE_TRACKS` y case en `spriteTrackFor()`.
8. **`src/lib/realtime/server.ts`** — agregar case en `actionAnimationMs()` y en `isActionCommand()` (si aplica).
9. **`src/components/control/`** — agregar botón al dpad / panel.
10. **Tests**: `parser.test.ts`, `reducer.test.ts`, `server.test.ts`.
11. **Regenerar audios**: `pnpm audios`.

> Si el comando requiere LLM runtime, seguí el patrón de `ANSWER_QUESTION`
> documentado en `AGENTS.md`. No metas LLM en comandos que pueden resolverse
> con el catálogo.