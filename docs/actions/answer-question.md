# ANSWER_QUESTION ⭐

Respuesta a pregunta abierta. **El único comando que toca LLM y TTS en runtime.**

> **Esta es la documentación canónica del flujo ANSWER_QUESTION.** El deep-dive técnicamente detallado que vivía en `AGENTS.md` se consolidó acá. Ver `docs/AGENTS.md` para las invariantes generales del sistema.

## TL;DR

Fork en T=0: preámbulo suena mientras LLM piensa. Cuando LLM responde, TTS sintetiza server-side como `data:audio/mpeg;base64,…` y se broadcastea inline. Tres niveles de degradación silenciosa.

## Flowchart

```mermaid
flowchart LR
    USER([👤 "qué es un robot?"]) -->|COMMAND| SVR

    subgraph SVR["🖥️ Server (server.ts:165)"]
        EXEC["EXECUTE → EXECUTING"]

        subgraph PAR["⚡ Parallel @ T=0"]
            direction TB
            LLM["LLM.call question"]
            BR1["SAY preamble audioUrl"]
        end

        SYN["synthesizeSpeech text → mp3"]
        BR2["SAY text + audioUrl data:audio/mpeg"]
        WAIT["waitForSpeechEnded"]
        COMP["COMPLETE → IDLE"]

        EXEC --> LLM
        EXEC --> BR1
        LLM --> SYN
        SYN --> BR2
        BR1 -.->|"no waiter"| BR2
        BR2 --> WAIT --> COMP
    end

    subgraph EXT["☁️ OpenAI"]
        OAI[(Chat gpt-4o-mini)]
        OAT[(TTS gpt-4o-mini-tts)]
    end

    SVR -->|SAY ×2| DISP

    subgraph DISP["📺 Display"]
        P1["playSay preamble.mp3"]
        P2["playSay data:audio/mpeg inline"]
        S1[play → SPEECH_STARTED]
        E1[ended → SPEECH_ENDED]
        S2[play → SPEECH_STARTED]
        E2[ended → SPEECH_ENDED]
        P1 --> S1 --> E1
        P2 --> S2 --> E2
    end

    LLM -.->|HTTP| OAI
    SYN -.->|HTTP| OAT

    DISP -->|SPEECH_ENDED| SVR
    E1 -.->|"no gate"| BR1
    E2 -.->|resolves| WAIT
```

**Leyenda**: 🟦 server · 🟨 sección paralela (fork @ T=0) · 🟩 display · 🟦🟦 external API. **Único paralelismo real del codebase**: preámbulo suena mientras LLM piensa. Después del LLM, todo es estrictamente secuencial (necesitamos el texto para sintetizar y broadcastear). Los dos HTTP externos son también dentro de ese pipeline secuencial.

## Forma

```ts
{ type: "ANSWER_QUESTION"; question: string }
```

`question` es la transcripción normalizada (sin acentos, sin `¿?`).

## Disparador

### Parser local (`src/lib/robi/parser.ts:62-68`)

`isQuestionIntent(raw, normalized)` retorna true si:

1. El texto crudo contiene `¿` o `?` (señal fuerte), **o**
2. Empieza con `que|por que|porque|cual|como|donde|cuando|quien` **y** tiene ≥3 palabras (filtra "que tal" y "como estas" que son GREET).

**Pre-check**: corre ANTES del pattern loop (`parser.ts:123`). Sin esto, "sabías que…?" matchearía TELL_FACT.

### LLM fallback

Si parser local devuelve UNKNOWN y la frase parece pregunta, el fallback LLM (`/api/interpret`) puede devolver ANSWER_QUESTION con `question`.

## Audio (preámbulo + respuesta TTS)

| # | Fuente | Categoría / provider | Formato |
|---|---|---|---|
| 1 (preámbulo) | Catálogo pre-generado | `ANSWER_QUESTION_PREAMBLE` | `/audio/question-preamble-01.mp3` |
| 2 (respuesta) | **LLM (OpenAI chat) + TTS (OpenAI)** | dinámica | `data:audio/mpeg;base64,…` inline en WS |

### Cadena de fallback (degradación elegante)

| Nivel | Condición | Resultado |
|---|---|---|
| 0 (happy path) | API key + LLM OK + TTS OK | SAY con data-URL |
| 1 | Sin `OPENAI_API_KEY` | SAY con `question-fallback-NN.mp3` del catálogo |
| 2 | LLM timeout (>15s) o error | Mismo que nivel 1 |
| 2 | LLM retorna texto vacío | Mismo que nivel 1 |
| 3 | TTS sintetización falla | SAY text-only; cliente hace `/api/tts` como segunda red |
| 4 | Cliente también falla `/api/tts` | Silencio (PRD: "niño nunca ve error técnico") |

## Pipeline (T-order)

```
T=0    fork:
         broadcast SAY(preamble)               ┐ en paralelo
         llmPromise = answerQuestion(question)  ┘

T=L    LLM returns answer text
       │
T=L+T  synthesizeSpeech(text) → mp3 Buffer
       │
T=L+T+T  broadcast SAY({
                  text,
                  audioUrl: `data:audio/mpeg;base64,${buf.toString('base64')}`
                })
       │
T=L+T+T+X  client audio ends → SPEECH_ENDED → drainQueue resumes
```

> **Paralelización SOLO en T=0**: preámbulo y LLM corren juntos. Después del LLM, todo es secuencial.

## State machine

| T | Event | Reducer | Sprite |
|---|---|---|---|
| 0 | `EXECUTE` | `EXECUTING` | `thinking` (mano en barbilla, espera LLM) |
| preámbulo_start | `<audio>.play` → `SPEECH_STARTED` → `SPEAK` | SPEAKING | `speaking` (override) |
| preámbulo_end | `SPEECH_ENDED` → `THINK` | THINKING | `thinking` |
| respuesta_start | `SPEAK` | SPEAKING | `speaking` |
| respuesta_end | `THINK` (content) | THINKING | `thinking` |
| post-delay | `COMPLETE` | IDLE | `idle` |

`actionAnimationMs(ANSWER_QUESTION) = 0` (content command).

### Reducer vs Sprite: dos sistemas paralelos

- **Reducer** mantiene THINKING entre SAYs (percepción: ROBI "piensa")
- **Sprite** cambia a SPEAKING durante CUALQUIER audio (mouth moving)

Ver `src/lib/realtime/server.ts:ingestSpeechEvent()`.

## Posición y dirección

No cambia. `pendingMove = null`.

## Flujo del servidor — rama dedicada

`src/lib/realtime/server.ts:165-219` — la rama más larga de `drainQueue`:

```ts
if (next.type === "ANSWER_QUESTION") {
  // Fork T=0
  const apiKey = process.env.OPENAI_API_KEY;
  const llmPromise = answerQuestion(next.question, apiKey);

  // Preámbulo (sin waiter)
  const preamble = questionPreambleResponse();   // tryPick("ANSWER_QUESTION_PREAMBLE")
  if (preamble) broadcast({ type: "SAY", payload: preamble });

  // Espera LLM (puede que el preámbulo ya haya terminado)
  const answer = await llmPromise;

  // answer puede tener audioUrl del catálogo (fallback) o no (LLM puro)
  const answerWithAudio = answer.audioUrl
    ? answer
    : await synthesizeAnswerAudio(answer.text).then(
        (audioUrl) => ({ text: answer.text, audioUrl }),
        (err) => {
          console.error("[tts] failed for ANSWER_QUESTION", err);
          return answer;  // cliente hace /api/tts como backstop
        },
      );

  // Waiter sobre la respuesta (NO sobre el preámbulo)
  const waiter = waitForSpeechEnded();
  broadcast({ type: "SAY", payload: answerWithAudio });
  await waiter;
}
```

### `synthesizeAnswerAudio` helper (`server.ts:392-399`)

```ts
async function synthesizeAnswerAudio(text: string): Promise<string> {
  const audio = await synthesizeSpeech(text);
  return `data:audio/mpeg;base64,${audio.toString("base64")}`;
}
```

30-80KB mp3 → ~100-200KB data URL. Aceptable para un solo mensaje WS por pregunta.

### ⚠️ Gotcha del waiter (¡no agregar para el preámbulo!)

El waiter se monta **después** del preámbulo, cubriendo SOLO la respuesta. Si se montara antes del preámbulo, el SPEECH_ENDED del preámbulo lo consumiría y la respuesta quedaría sin gate. AGENTS.md lo documenta.

## Sprite track

**`thinking`** durante toda la operación (mientras LLM piensa + durante el audio de respuesta, porque el SPRITE del reducer es THINKING). Override a `speaking` solo cuando `<audio>.play` fires (lifecycle event del cliente).

Ver `src/components/display/sprites.ts:spriteTrackFor()` case `ANSWER_QUESTION` → `SPRITE_TRACKS.thinking`.

## Edge cases

| Caso | Comportamiento |
|---|---|
| Catálogo `ANSWER_QUESTION_PREAMBLE` vacío | `tryPick` retorna null → no se broadcastea preámbulo. LLM sigue corriendo. |
| `OPENAI_API_KEY` no configurada | `answerQuestion` salta el LLM, retorna fallback del catálogo. Cliente recibe SAY con audioUrl pregrabado. |
| LLM retorna string vacío | Fallback del catálogo (gpt-4o-mini raramente, pero pasa). |
| TTS call falla | Catch en `synthesizeAnswerAudio`. Cliente recibe SAY text-only, hace `/api/tts` (con LRU cache). |
| Cliente hace `/api/tts` y la respuesta es muy larga | LRU cache miss → llamada a OpenAI. Latencia adicional ~2-5s. |
| Display peer desconectado | El `waitForSpeechEnded()` safety timer (8s) termina el gate. `drainQueue` continúa. |
| Múltiples preguntas en queue | Solo 1 en vuelo (`state.processing`). Las demás esperan. |

## Diagnóstico de "ruido"

Si ANSWER_QUESTION se comporta raro, verificá en este orden:

| Síntoma | Dónde mirar |
|---|---|
| No suena el preámbulo | `sonidos/audios/question-preamble-01.mp3`. Si no existe, `tryPick` retorna null. |
| LLM nunca responde | `process.env.OPENAI_API_KEY`. Sin key, fallback inmediato. Con key, timeout 15s → fallback. |
| LLM responde pero no se TTS-ea | `synthesizeSpeech()` en `src/lib/tts/synthesize.ts`. Sin OPENAI_API_KEY tira "No TTS provider configured". Catch lo maneja → cliente hace `/api/tts`. |
| Gap larguísimo entre preámbulo y respuesta | Normal si LLM es lento. Acceptable. Si querés más filler, agregar más preámbulos al catálogo. |
| Respuesta suena con voz equivocada | `src/lib/tts/synthesize.ts`: constante `voice = "fable"`. Cambiar TTS_VOICE env var. |
| Cliente rebota a `/api/tts` por bug | `src/lib/realtime/server.ts:synthesizeAnswerAudio()` debería devolver data URL. Si no, SAY llega sin audioUrl. |
| El sprite no vuelve a `thinking` | Cliente no envía SPEECH_ENDED. Display tiene error en su lifecycle. |
| Estado no transiciona a IDLE | Safety timer (8s) está bloqueando `drainQueue`. |

### Si querés logs de debug

```bash
# Ver los logs del server
pnpm dev

# O producción:
node ./server.mjs
```

Busca líneas como:
- `[llm] answer failed (status)` — LLM error
- `[llm] answer timed out after 15000ms` — timeout
- `[drainQueue] TTS failed for ANSWER_QUESTION` — error TTS (con backstop al cliente)

## Puntos de tweak

| Querés cambiar... | Archivo:línea | Notas |
|---|---|---|
| Timeout LLM | `src/lib/llm/answer-question.ts:17` (`TIMEOUT_MS = 15_000`) | Subir si la red es lenta. |
| Voz del TTS | `src/lib/tts/synthesize.ts` (default `fable`) o env `TTS_VOICE` | |
| Modelo LLM | `src/lib/llm/answer-question.ts:15` (`MODEL = "gpt-4o-mini"`) | Cambiar a `gpt-4o` para mejor calidad. |
| System prompt del LLM | `src/lib/llm/answer-question.ts:20-32` (constante `SYSTEM_PROMPT`) | Reglas duras: kid-safe, sin revelar IA, sin URLs, etc. |
| Max tokens de respuesta | `src/lib/llm/answer-question.ts:18` (`MAX_TOKENS = 200`) | Limita largo de la respuesta. |
| Texto pre-grabado del preámbulo | `sonidos/audios.json` + `pnpm audios` | Categoría `ANSWER_QUESTION_PREAMBLE`. |
| Texto fallback (sin API key) | `sonidos/audios.json` + `pnpm audios` | Categoría `ANSWER_QUESTION_FALLBACK`. |
| Sprite durante espera LLM | `src/components/display/sprites.ts:SPRITE_TRACKS.thinking` y el case en `spriteTrackFor()` | Actual = `thinking`. Cambiable. |
| Data URL → servir vía endpoint | Reemplazar `data:audio/mpeg;base64,…` con `/api/tts-audio/<id>` | Mucho trabajo; data URL es OK para MVP. |
| LRU cache size | `src/lib/tts/synthesize.ts:MAX_CACHE = 32` | Subir si crecen las frases frecuentes. |

## Dependencias

- `src/types/robi.ts:28` — type con `question: string`
- `src/lib/robi/parser.ts:62-68` + `isQuestionIntent()`
- `src/lib/robi/reducer.ts:181-186`
- `src/lib/robi/responses.ts:172-191` (questionPreambleResponse + questionFallbackResponse)
- `src/lib/llm/answer-question.ts:48-106` (answerQuestion)
- `src/lib/llm/system-prompt.ts` (prompt del parser fallback, no el de Q&A)
- `src/lib/tts/synthesize.ts:52-69` (synthesizeSpeech + LRU)
- `src/lib/realtime/server.ts:165-219` (rama dedicada drainQueue)
- `src/lib/realtime/server.ts:392-399` (synthesizeAnswerAudio helper)
- `src/components/display/sprites.ts:230-232` (case ANSWER_QUESTION)
- `sonidos/audios/question-preamble-01.mp3` + `question-fallback-{01,02}.mp3`
- `src/pages/api/tts.ts` (backstop del cliente)

## Tests

- `src/lib/realtime/server.test.ts`:
  - **"ANSWER_QUESTION without an API key falls back to a friendly SAY"** — verifica el fallback completo (sin API key → catálogo).
  - **"ANSWER_QUESTION preamble is broadcast immediately (don't wait for LLM)"** — verifica el timing T=0 fork.
  - **"ANSWER_QUESTION bundles the LLM answer as a data:audio/mpeg URL"** — happy path con mocks de LLM y TTS, hermético (sin API calls reales).

## Por qué ESTE path es diferente

ANSWER_QUESTION es el único comando que:
- Llama un LLM en tiempo de request.
- Llama `synthesizeSpeech()` en tiempo de request.
- Usa `data:` URL para `audioUrl` (otros usan `/audio/*.mp3` estáticos).

Si querés agregar otro comando dinámico (TRANSLATE, SING), seguí este mismo patrón. **No** metas LLM en comandos que pueden resolverse con el catálogo.
