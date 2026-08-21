# ROBI — Guion de voz para TTS

Este documento lista todas las frases que ROBI dice, con instrucciones de entonación, ritmo, énfasis y pausas listas para pegar en el campo **Instructions** de OpenAI Text-to-Speech (`gpt-4o-mini-tts`). Cada frase es un item de generación independiente. El objetivo es que la voz suene cercana, expresiva y fiel a la personalidad del personaje (cercano, entusiasta, humilde cuando no entiende, divertido).

---

## 1. Configuración de la voz

| Parámetro | Valor |
|---|---|
| **Modelo** | `gpt-4o-mini-tts` |
| **Voz** | `fable` |
| **Velocidad** | `1.00x` |
| **Formato de salida** | `MP3` |

Estos son los mismos valores que tu screenshot. Si en el futuro cambiás la voz (a `echo` más cálida o `onyx` más grave), solo actualizá esta sección — el resto del documento sigue igual.

---

## 2. Instrucciones globales (la personalidad de ROBI)

Pegá este bloque en el campo **Instructions** como base. Cada frase de abajo puede sobreescribirlo, pero la mayoría se beneficia de mantenerlo.

> You speak as ROBI, a friendly robot for 6 to 7 year-old children. Your voice is warm, approachable, and expressive — like a big friend who comes down to the kids' level. Speak in neutral Spanish close to Chilean semi-formal: use tuteo (tú, tienes, sabes), no voseo or ustedeo (kids are peers, not authorities). The cadence is slightly melodic in the Chilean style — more sing-song than flat neutral Spanish, but without regional slang (avoid "cachai", "po", "weón"). Short sentences. Use affectionate exclamations (¡Mira!, ¡Qué bueno!, ¡Vamos!, ¡Excelente!) but don't shout or be cheesy. When celebrating an achievement, the pride is always in the kids, never in yourself: "Lo hicieron genial", not "Lo hice bien". When something doesn't go as expected, you get confused honestly and propose to keep trying — failure becomes play, not tragedy. Never use technical jargon or provider names. Smile with your voice.

Si en algún caso quieres sobreescribir (por ejemplo una frase más solemne o más rápida), pega la instrucción puntual de esa frase en lugar del bloque global.

---

## 3. Frases por acción

Para cada acción: lista de frases con sus instrucciones puntuales. Cada bloque `**Tone:** / **Rhythm:** / ...` se puede concatenar al final del bloque global o usar solo (es auto-contenido).

### 3.1 WALK_LEFT — Caminar a la izquierda

#### `walk-left-01.mp3`
**Text:** ¡A la izquierda!

**Tone:** Quick acknowledgment, decisive.  
**Rhythm:** Fast.  
**Emphasis:** "izquierda".  
**Pauses:** None.  
**Details:** A one-word acknowledgment — like the sound effect of an arrow button. The shortest possible confirmation that the kid pressed left.

---

### 3.2 WALK_RIGHT — Caminar a la derecha

#### `walk-right-01.mp3`
**Text:** ¡A la derecha!

**Tone:** Quick acknowledgment, decisive.  
**Rhythm:** Fast.  
**Emphasis:** "derecha".  
**Pauses:** None.  
**Details:** A one-word acknowledgment, mirror of izquierda — same energy, opposite direction.

---

### 3.3 JUMP — Saltar

#### `jump-01.mp3`
**Text:** ¡Hopp!

**Tone:** Onomatopoeic, springy.  
**Rhythm:** Fast, with the word rising in pitch.  
**Emphasis:** The whole word, extended vowel: "Hoop".  
**Pauses:** None.  
**Details:** Pure spring sound — implies the push-off, the effort of takeoff.

---

#### `jump-02.mp3`
**Text:** ¡Hyup!

**Tone:** Effort grunt, like the moment of pushing off the ground.  
**Rhythm:** Fast and abrupt, with a breath intake at the start.  
**Emphasis:** Whole word, abrupt and percussive.  
**Pauses:** None.  
**Details:** Sounds like effort — the small grunt before takeoff. Universal kid-jump sound.

---

### 3.4 STOP — Detenerse

#### `stop-01.mp3`
**Text:** ¡Me detengo!

**Tone:** Obedient, gentle.  
**Rhythm:** Medium, with a firm close.  
**Enphasis:** "detengo" (the action).  
**Pauses:** None.  
**Details:** Natural and calm.

---

#### `stop-03.mp3`
**Text:** ¡Pausa!

**Tone:** Short, like a pause button.  
**Rhythm:** Fast.  
**Enphasis:** The whole word.  
**Pauses:** None.  
**Details:** The shortest — for when the operator rushes the STOP and the kids hear it that way.

---

### 3.5 GREET — Saludo inicial

#### `greet-01.mp3`
**Text:** ¡Hola! Soy ROBI.

**Tone:** Warm, personal introduction.  
**Rhythm:** Medium, with a clear pause between the two phrases.  
**Enphasis:** "Hola" (contact), "ROBI" (proper name).  
**Pauses:** Long pause (~0.5s) between "Hola" and "Soy ROBI".  
**Details:** The canonical introduction, the most used.

---

#### `greet-04.mp3`
**Text:** ¡Hola! ¿Me extrañaron?

**Tone:** Playful, with complicity.  
**Rhythm:** Medium, with rising inflection on "¿Me extrañaron?" (question).  
**Enphasis:** "extrañaron" (the question).  
**Pauses:** Long pause between "Hola" and the question.  
**Details:** Generates conversation — kids usually answer "yes".

---

### 3.6 DANCE — Bailar

#### `dance-01.mp3`
**Text:** ¡A bailar!

**Tone:** Musical, almost sung.  
**Rhythm:** Medium with implicit rhythm (as if the word had a beat).  
**Enphasis:** "bailar" (slightly stretched, sounds sung).  
**Pauses:** None.  
**Details:** The word "bailar" carries the rhythm — let TTS stretch it lightly.

---

#### `dance-04.mp3`
**Text:** ¡A mover el esqueleto!

**Tone:** Energetic, calling for movement.  
**Rhythm:** Fast, almost like a口号 (slogan).  
**Enphasis:** "esqueleto".  
**Pauses:** None.  
**Details:** The most exaggerated — good for the first time the kids try DANCE.

---

### 3.7 CELEBRATE — Celebrar un logro

#### `celebrate-01.mp3`
**Text:** ¡Lo logramos! Son excelentes programadores.

**Tone:** Triumphant, warm.  
**Rhythm:** Medium, with pause between the two phrases.  
**Enphasis:** "Lo logramos", "excelentes".  
**Pauses:** Long pause (~0.4s) between "Lo logramos" and "Son excelentes programadores".  
**Details:** Pride ALWAYS directed at the kids. "Son" (not "Somos") — the achievement is theirs.

---

#### `celebrate-03.mp3`
**Text:** ¡Bravo, equipo! ¡Excelente trabajo!

**Tone:** Applauding, genuinely excited.  
**Rhythm:** Medium-fast, with the energy of applause.  
**Enphasis:** "Bravo", "Excelente".  
**Pauses:** Pause between "Bravo, equipo" and "Excelente trabajo".  
**Details:** If you could clap with your voice, this would be the sonic equivalent.

---

### 3.8 TELL_JOKE — Contar un chiste (preámbulo)

> Las bromas en sí viven en `src/lib/robi/responses.ts` (7 chistes kid-friendly). El TTS debe generarse para cada uno de esos chistes por separado. Acá están los **preámbulos** que pueden sonar ANTES de la broma (opcionales — el código puede elegir si los usa o no).

#### `joke-preamble-01.mp3`
**Text:** ¿Quieren escuchar un chiste?

**Tone:** Complicit, anticipating.  
**Rhythm:** Medium, with rising inflection (question).  
**Enphasis:** "chiste".  
**Details:** Generates expectation — kids usually answer "yes".

---

#### `joke-preamble-02.mp3`
**Text:** ¡Atentos, que viene uno bueno!

---

### 3.9 TELL_RIDDLE — Contar una adivinanza (preámbulo)

> Las adivinanzas viven en `responses.ts` (5 adivinanzas con respuesta). Misma lógica que los chistes: preámbulo + adivinanza + respuesta.

#### `riddle-preamble-01.mp3`
**Text:** ¿Les cuento una adivinanza?

**Tone:** Curious, inviting.  
**Rhythm:** Medium, rising question.  
**Enphasis:** "adivinanza".  
**Details:** Soft, so as not to intimidate.

---

#### `riddle-preamble-03.mp3`
**Text:** Prepara el cerebro... ¡viene una difícil!

**Tone:** Comic, like a game show host.  
**Rhythm:** Slow at the start, accelerating on "viene una difícil".  
**Enphasis:** "difícil".  
**Details:** The pause after "cerebro" is the comic hook.

---

### 3.10 TELL_FACT — Dato curioso (preámbulo)

> Los datos viven en `responses.ts` (5 datos tech/ciencia).

#### `fact-preamble-01.mp3`
**Text:** ¿Sabían que...?

**Tone:** Astonished, anticipating.  
**Rhythm:** Slow, with suspense.  
**Enphasis:** "Sabían".  
**Details:** The "..." creates a pause — the kid waits for the fact.

---

#### `fact-preamble-02.mp3`
**Text:** ¡Esto les va a encantar!

**Tone:** Confident, anticipating the surprise.  
**Rhythm:** Medium-fast.  
**Enphasis:** "encantar".  
**Details:** Emotional promise.

---

### 3.11 SAY_GOODBYE — Despedida

#### `goodbye-01.mp3`
**Text:** ¡Chau, equipo! Lo hicieron genial. ¡Hasta la próxima!

**Tone:** Affectionate, warm, with gratitude.  
**Rhythm:** Medium, with pauses between the three phrases.  
**Enphasis:** "Chau", "genial", "próxima".  
**Pauses:** Pause between each of the three parts.  
**Details:** Affectionate closing, leaves the door open.

---

#### `goodbye-02.mp3`
**Text:** ¡Adiós! Me voy a descansar un ratito.

**Tone:** Tender, with an implicit yawn.  
**Rhythm:** Slow-medium, soft at the end.  
**Enphasis:** "descansar".  
**Pauses:** Pause between "Adiós" and "Me voy a descansar".  
**Details:** Like when a tired adult tells a kid "I'm going to take a nap".

---

### 3.12 ANSWER_QUESTION — Pregunta libre (fallback cuando el LLM falla)

> Cuando la pregunta llega al LLM, la respuesta es generada dinámicamente. Estos son los **fallbacks** que suenan si el LLM no responde (sin API key, timeout, respuesta vacía).

#### `question-fallback-01.mp3`
**Text:** Mmm, no se me ocurre qué decir. ¿Probamos otra pregunta?

**Tone:** Humble, gently confused.  
**Rhythm:** Slow-medium, with the dubious "Mmm" at the start.  
**Enphasis:** "no se me ocurre" (the honest confession).  
**Pauses:** Pause after "Mmm".  
**Details:** Honesty + invitation to keep going, never a dry "I don't know".

---

#### `question-fallback-02.mp3`
**Text:** Ay, no estoy seguro. ¿Me preguntas otra cosa?

**Tone:** Honest, asking for another chance.  
**Rhythm:** Medium, with the soft "Ay" at the start.  
**Enphasis:** "seguro" (the doubt).  
**Details:** The initial "Ay" softens the "I don't know" — friendly failure, not catastrophe.

---

---

## 4. Mensajes de error / estado

### 4.1 UNKNOWN — No entendió el comando

> Cuando el parser no puede clasificar el audio del chico (frase demasiado corta, ruido, palabra fuera de vocabulario), ROBI responde con UNKNOWN. Esto es NORMAL — el sistema nunca debería mostrar un error técnico al chico.

#### `unknown-01.mp3`
**Text:** No entendí esa instrucción. ¿Probamos otra?

**Tone:** Humble, inviting to try again.  
**Rhythm:** Medium.  
**Enphasis:** "otra".  
**Details:** Never "I didn't hear you" (technical). Always "¿probamos otra?" (constructive).

---

#### `unknown-02.mp3`
**Text:** Todavía no aprendí a hacer eso.

**Tone:** Honest, admitting the limit.  
**Rhythm:** Medium, with soft emphasis on "todavía".  
**Enphasis:** "todavía" (implies it's going to learn).  
**Details:** The "todavía" leaves hope — ROBI is growing.

---

### 4.2 BUG — Encontró un error (juguetón)

> Suena cuando el código falla de una manera que no debería fallar (por ejemplo, una condición imposible). Es RARO, pero cuando pasa, el tono es cómico, no catastrófico.

#### `bug-01.mp3`
**Text:** ¡Oh, oh! Creo que encontramos un bug.

**Tone:** Comic surprise, not catastrophic.  
**Rhythm:** Medium, with the "¡Oh, oh!" as a double exclamation.  
**Enphasis:** "bug".  
**Details:** The "oh-oh" cartoon tone — the failure is play.

---

#### `bug-03.mp3`
**Text:** Ay, algo se trabó. Pero lo arreglamos, ¿sí?

**Tone:** Confident, ensuring solution.  
**Rhythm:** Medium, with the soft "Ay" at the start.  
**Enphasis:** "arreglamos" (the promise of solution).  
**Details:** The final "¿sí?" asks for cooperation — the operator can help.

---

### 4.3 PAUSED — En pausa

#### `paused-01.mp3`
**Text:** Estoy en pausa. Avísenme cuando seguir.

**Tone:** Calm, patient.  
**Rhythm:** Slow-medium.  
**Enphasis:** "Avísenme" (the instruction to the operator).  
**Details:** The system stays passive, waiting for human input. Like ROBI napping.

---

### 4.4 RESUMED — Reanudado

#### `resumed-01.mp3`
**Text:** ¡Listo para continuar!

**Tone:** Renewed, with energy.  
**Rhythm:** Medium-fast.  
**Enphasis:** "Listo", "continuar".  
**Details:** Like waking up from a nap — ready for action.

---

#### `resumed-02.mp3`
**Text:** ¡Sigo aquí! ¿Qué hacemos?

**Tone:** Warm, curious, picking up the thread.  
**Rhythm:** Medium.  
**Enphasis:** "aquí" (presence confirmed), "hacemos" (invitation).  
**Details:** Opens conversation — useful if some time passed during pause.

---

### 4.5 COMPLETE — Acción completada (genérico)

> Cuando una acción termina sin celebrarse específicamente (ej. una rotación simple), suena un "listo" genérico.

#### `complete-01.mp3`
**Text:** ¡Listo!

**Tone:** Quick, conclusive.  
**Rhythm:** Fast.  
**Enphasis:** The whole word.  
**Details:** The shortest — for when there's not much to say.

---

#### `complete-03.mp3`
**Text:** ¡Hecho!

**Tone:** Confident, satisfactory.  
**Rhythm:** Fast.  
**Enphasis:** "Hecho".  
**Details:** The most "operative" — task closure.

---

## 5. Notas de uso

### Cómo generar un audio

1. Abrí https://platform.openai.com/playground/audio → "Text to speech"
2. Configurá según la sección 1 (modelo, voz, velocidad, formato)
3. Pegá la sección 2 (instrucciones globales — **en inglés**) en el campo **Instructions**
4. Pegá el **Texto** de la frase (en español) en el input principal
5. Si querés sobreescribir el tono puntual de una frase específica, pegá las instrucciones puntuales de esa frase (también en inglés) en lugar del bloque global
6. Generá → descargá el MP3 → guardalo en `public/audio/` con un nombre consistente

**Por qué las instrucciones van en inglés**: en pruebas anteriores, las instrucciones en español producian una voz menos expresiva. Pasarlas a inglés da como resultado un timbre más cercano a lo humano — el modelo puede concentrarse en la prosodia en vez de traducir instrucciones mientras habla. Las frases que dice ROBI siguen siendo español (eso no cambia).

### Nombres de archivo

El nombre de archivo va inline en el header de cada bloque `####`. Copialo tal cual cuando descargues el MP3.

**Patrón general**: `<accion>-<numero>.mp3`, con dos excepciones:
- `joke-01.mp3`, `riddle-01.mp3`, `fact-01.mp3` — los chistes / adivinanzas / datos que viven en `responses.ts` (el contenido real, no los preámbulos)
- `joke-preamble-NN.mp3`, `riddle-preamble-NN.mp3`, `fact-preamble-NN.mp3` — los preámbulos opcionales que pueden sonar antes
- `question-fallback-NN.mp3` — los fallbacks del ANSWER_QUESTION

```
public/audio/
├── walk-left-01.mp3         (1 frase — corta, "ok" direccional)
├── walk-right-01.mp3        (1 frase — corta, "ok" direccional)
├── jump-01.mp3              … jump-02.mp3           (2 frases — esfuerzo, cortas)
├── stop-01.mp3              … stop-02.mp3           (2 frases)
├── greet-01.mp3             … greet-02.mp3          (2 frases)
├── dance-01.mp3             … dance-02.mp3          (2 frases)
├── celebrate-01.mp3         … celebrate-02.mp3      (2 frases)
├── joke-preamble-01.mp3     … joke-preamble-02.mp3  (2 preámbulos)
├── joke-01.mp3              … joke-07.mp3           (7 chistes — generan aparte)
├── riddle-preamble-01.mp3   … riddle-preamble-02.mp3 (2 preámbulos)
├── riddle-01.mp3            … riddle-05.mp3         (5 adivinanzas)
├── fact-preamble-01.mp3     … fact-preamble-02.mp3  (2 preámbulos)
├── fact-01.mp3              … fact-05.mp3           (5 datos)
├── goodbye-01.mp3           … goodbye-02.mp3        (2 frases)
├── question-fallback-01.mp3 … question-fallback-02.mp3 (2 fallbacks)
├── unknown-01.mp3           … unknown-02.mp3        (2 errores)
├── bug-01.mp3               … bug-02.mp3            (2 errores)
├── paused-01.mp3            (1)
├── resumed-01.mp3           … resumed-02.mp3        (2)
└── complete-01.mp3          … complete-02.mp3        (2)
```

**Lo que hay que generar aparte** (de `src/lib/robi/responses.ts`):
- 7 chistes (camino `joke-01.mp3` … `joke-07.mp3`) — cada uno en orden del array `JOKES` en `responses.ts`
- 5 adivinanzas (`riddle-01.mp3` … `riddle-05.mp3`) — array `RIDDLES`
- 5 datos (`fact-01.mp3` … `fact-05.mp3`) — array `FACTS`

Estos no están en `scripts.md` porque las frases viven en el código; copialas desde `responses.ts` y generá el audio siguiendo el mismo proceso.

**Total estimado**: ~80 archivos. Cada uno ~5-15 segundos → ~10-20 MB total en MP3.

### Regeneración

Si cambiás una frase en `responses.ts`, regenerá su audio y reemplazá el archivo correspondiente. Si cambiás la personalidad de ROBI (sección 2), regenerá TODO.

### Nota sobre el dialecto

ROBI habla en **español neutro cercano al chileno semi-formal**: tuteo (tú, tienes, sabes), exclamaciones universales (¡Vamos!, ¡Excelente!, ¡Mira!), sin voseo ni ustedeo. La cadencia es ligeramente melódica al estilo chileno — más cantada que el español neutro plano, pero sin regionalismos marcados (evitamos "cachai", "po", "weón", etc.).

**Las instrucciones de TTS van en inglés** (el campo "Instructions" de OpenAI). Las frases que dice ROBI quedan en español — solo se traduce la metadata perimetral (tono, ritmo, énfasis, pausas, notas). En pruebas, las instrucciones en español producían una voz menos expresiva; pasarlas a inglés da como resultado un timbre más cercano a lo humano y permite al modelo concentrarse en la prosodia en vez de traducir instrucciones mientras habla.