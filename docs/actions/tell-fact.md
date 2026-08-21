# TELL_FACT

Contar un dato curioso. El niño dice "sabías que…" / "ROBI dato curioso".

## TL;DR

Comando de contenido con preámbulo + dato + gap de 1.2s. Sprite = `speaking` (igual que TELL_JOKE).

## Flowchart

```mermaid
flowchart LR
    USER([👤 "sabías que…"]) -->|COMMAND| SVR

    subgraph SVR["🖥️ Server (server.ts:185)"]
        EXEC["EXECUTE"]
        BR1["SAY fact-preamble audioUrl"]
        SLEEP["sleep preambleMs + 100ms (dynamic)"]
        BR2["SAY fact audioUrl"]
        WAIT["waitForSpeechEnded"]
        COMP["COMPLETE → IDLE"]
        EXEC --> BR1 --> SLEEP --> BR2 --> WAIT --> COMP
    end

    SVR -->|SAY ×2| DISP

    subgraph DISP["📺 Display"]
        P1[playSay preamble]
        S1[play → SPEECH_STARTED]
        E1[ended → SPEECH_ENDED]
        P2[playSay fact]
        S2[play → SPEECH_STARTED]
        E2[ended → SPEECH_ENDED]
        P1 --> S1 --> E1
        P2 --> S2 --> E2
    end

    DISP -->|SPEECH_ENDED| SVR
    E1 -.->|"no waiter"| BR1
    E2 -.->|resolves| WAIT
```

**Leyenda**: 🟦 server · 🟩 display. Mismo patrón server que JOKE/RIDDLE. **Colisión**: `sabías que…?` con `?` → ANSWER_QUESTION (pre-check de `isQuestionIntent`); sin `?` → TELL_FACT.

## Forma

```ts
{ type: "TELL_FACT" }
```

## Disparador

### Parser local (`src/lib/robi/parser.ts:105`)

```ts
{ cmd: "TELL_FACT", test: /\b(dato|dato curioso|sabias que|curiosidad|cuento algo)\b/ }
```

⚠️ **Colisión potencial**: `sabias que…?` con signo de pregunta matchea `ANSWER_QUESTION` (pre-check de `isQuestionIntent`). Sin `?`, matchea `TELL_FACT`.

- "sabías que los pulpos tienen tres corazones" → TELL_FACT (afirmación)
- "¿sabías que…?" → ANSWER_QUESTION (pregunta)

## Audio (preámbulo + dato)

| # | Categoría | Archivos |
|---|---|---|
| 1 (preámbulo) | `TELL_FACT_PREAMBLE` | `public/audio/fact-preamble-{01,02}.mp3` |
| 2 (dato) | `FACT` | `public/audio/fact-{01..05}.mp3` (5 entries) |

Gap: **`preambleDurationMs("fact") + 100ms`** (dinámico, ver [tell-joke.md](./tell-joke.md#audio)). Antes era un valor fijo de 1200ms que cortaba los preámbulos largos.

## State machine

Idéntico a [TELL_JOKE](./tell-joke.md#state-machine).

`actionAnimationMs(TELL_FACT) = 0` (content command).

## Sprite track

**`speaking`** (track, 3 frames, 0.45s loop). Igual que JOKE. Distinto de RIDDLE que usa `thinking`.

## Edge cases

- **"sabías que…" con `?` al final**: va a ANSWER_QUESTION. El LLM recibe la pregunta. Si no sabe, fallback "mmm no se me ocurre".
- **TELL_FACT antes de PAUSED**: WAIT activo, retorna a IDLE post-audio.

## Diagnóstico

| Síntoma | Dónde mirar |
|---|---|
| TELL_FACT no se dispara con "sabías que" | `parser.ts:105` — regex no matchea. Verifica que `sabias que` (sin acento) está en el regex. |
| Manda a ANSWER_QUESTION en lugar de TELL_FACT | Frase tiene `?` o empieza con "que|por que|…" (3+ palabras). `isQuestionIntent()` la intercepta antes. |
| Manda a TELL_FACT en lugar de ANSWER_QUESTION | Frase no es pregunta pero el LLM devolvería una pregunta. No debería pasar si tu regex está bien. |

## Puntos de tweak

Iguales a TELL_JOKE.

## Dependencias

- `src/types/robi.ts:24`
- `src/lib/robi/parser.ts:105`
- `src/lib/robi/responses.ts:60`
- `src/lib/realtime/server.ts:185-216`
- `src/components/display/sprites.ts:225-227`
- `sonidos/audios/fact-preamble-{01,02}.mp3` + `fact-{01..05}.mp3`

## Tests

- `src/lib/realtime/server.test.ts`:
  - "TELL_FACT broadcasts a fact-preamble then the fact"
