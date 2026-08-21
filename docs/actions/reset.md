# RESET

Volver al origen. El niño dice "ROBI vuelve al inicio"; el operador usa el botón "🏠" del dpad o el botón de emergencia (que es una variante que llama `ingestWorldEvent("RESET")` directamente).

## TL;DR

Único comando que usa TTS dinámico (literal "Vuelvo al inicio."). Tiene DOS paths: vía comando (queue-friendly) o vía evento (inmediato, corta todo).

## Forma

```ts
{ type: "RESET" }  // vía comando
ingestWorldEvent("RESET")  // vía control directo (corta cualquier cosa)
```

## Disparador

### Parser local (`src/lib/robi/parser.ts:86`)

```ts
{ cmd: "RESET", test: /\b(reiniciar|reset|inicio|vuelve a empezar|comienza de nuevo|empieza de nuevo)\b/ }
```

### Vía control

`src/components/control/EmergencyControls.tsx` — botón de reset llama `ingestWorldEvent("RESET")` (path inmediato).

## Audio

**Sin audio pre-generado.** Texto literal "Vuelvo al inicio." → `dynamicFallback("RESET")` en `src/lib/robi/responses.ts:108-111`.

El cliente sintetiza con `/api/tts` (POST {text}). Si el TTS ya cacheó esta frase (LRU), es instantáneo.

> Por qué no hay catálogo pre-generado: RESET se llama raramente (emergency). El costo de un audio sintetizado es aceptable. Ventaja: si querés cambiar el texto, edita `responses.ts` directamente sin regenerar audios.

## State machine — DOS paths

### Path A: vía comando (`{type: "RESET"}`)

| T | Event | Reducer | Sprite |
|---|---|---|---|
| 0 | `EXECUTE {command: RESET}` | `IDLE` con `state.world = { ...initialWorld }` | `idle` |
| audio_end (TTS) | `THINK` | THINKING | `idle` |
| post-audio | `COMPLETE` | IDLE (sin cambio) | `idle` |

`actionAnimationMs(RESET) = 0` (content command). El reset es instantáneo en términos de reducer; solo espera al TTS.

`pendingMove` se descarta en EXECUTE (RESET siempre vuelve a origen).

### Path B: vía evento (`ingestWorldEvent("RESET")`)

```ts
case "RESET":
  state.queue = [];
  state.processing = false;
  state.world = { ...initialWorld, state: "IDLE" };
  broadcast({ type: "RESET" });
  broadcast({ type: "STATE_CHANGED", payload: "IDLE" });
  break;
```

`src/lib/realtime/server.ts:357-363`.

**Diferencias clave del Path B**:
- Vacía la queue (descarta comandos pendientes)
- Resetea `processing = false` (unlocks `drainQueue`)
- Asigna `initialWorld` (position 0,0; direction SOUTH; state IDLE)
- **NO emite SAY** — el display hace `stopAudio()` por su cuenta al ver `RESET`
- Broadcast dual: `RESET` + `STATE_CHANGED: IDLE`

## Posición y dirección

- **Path A**: posición y dirección se resetean en EXECUTE (`initialWorld`).
- **Path B**: idem.

## Flujo del servidor — path A

Branch genérico (línea ~246), pero `phrase` viene de `dynamicFallback`:

```ts
const phrase = responseForWithAudio(next);  // { text: "Vuelvo al inicio.", audioUrl: undefined }
const waiter = waitForSpeechEnded();
broadcast({ type: "SAY", payload: phrase });
await waiter;
```

El cliente, al recibir SAY sin `audioUrl`, llama `/api/tts`. El TTS se produce server-side (con LRU cache de `synthesize.ts`).

## Sprite track

Sprite = `idle` (porque el state es `IDLE` desde el EXECUTE). 1 frame estático.

## Edge cases

- **RESET durante audio**: el waiter actual termina normalmente; luego llega `COMPLETE → IDLE`.
- **RESET en emergency path** (Path B): corta CUALQUIER audio en reproducción en el cliente (`Robi.tsx:90-94`).
- **Multi-RESET rápido (Path A)**: el segundo RESET se queuea pero el server puede lockearlo; el primer RESET procesa antes.

## Diagnóstico de "ruido"

| Síntoma | Dónde mirar |
|---|---|
| RESET no vuelve a posición origen | `src/lib/robi/reducer.ts:174-175` — case `RESET` debe usar `...initialWorld`. |
| Audio del RESET se traba | Cliente → `/api/tts` → sin OPENAI_API_KEY. Sin key, falla el fetch. Ver `Robi.tsx:197` (silent fail). |
| Path B no corta audio | `Robi.tsx:90-94` — case `RESET` debe llamar `stopAudio()` (si lo está). |
| Path B no resetea posición | `src/lib/realtime/server.ts:357` — asignación de `initialWorld`. |
| Diferencia visual entre paths | Path A emite SAY ("Vuelvo al inicio."). Path B no. Decisión de UX. |

## Puntos de tweak

| Querés cambiar... | Archivo:línea |
|---|---|
| Texto literal | `src/lib/robi/responses.ts:108-111` (dynamicFallback) |
| Path B (emergency) comportamiento | `src/lib/realtime/server.ts:357-363` |
| Botón de emergencia (UI) | `src/components/control/EmergencyControls.tsx` |
| Estado post-reset (initialWorld) | `src/lib/robi/reducer.ts:34-40` |

## Dependencias

- `src/types/robi.ts:20` — type literal
- `src/lib/robi/parser.ts:86` — regex
- `src/lib/robi/reducer.ts:174-175` — EXECUTE con initialWorld
- `src/lib/robi/responses.ts:108-111` — dynamicFallback
- `src/lib/realtime/server.ts:357-363` — ingestWorldEvent("RESET")
- `src/lib/realtime/server.ts:332-336` — ingestSay (Rama genérica)
- `src/components/control/EmergencyControls.tsx` — botón UI
- `src/pages/api/tts.ts` — endpoint TTS dinámico
- `src/lib/tts/synthesize.ts` — LRU cache

## Tests

- `src/lib/realtime/server.test.ts`:
  - "RESET clears state and broadcasts"
