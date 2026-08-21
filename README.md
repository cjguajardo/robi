# ROBI

Robot interactivo por voz para presentación escolar.

**Stack:** Astro 7 + React 19 + TypeScript + WebSocket + OpenAI (Whisper / TTS).

---

## Arranque rápido

```bash
pnpm install
cp .env.example .env        # opcional — solo si vas a usar voz real
pnpm dev                    # abre http://localhost:4321
```

Para producción:

```bash
pnpm build
pnpm start                  # http://localhost:4321
```

### Vistas

| Ruta | Dispositivo | Qué hace |
|------|-------------|----------|
| `/`          | cualquiera  | Landing con el logo + enlaces |
| `/display`   | proyector   | Escena fullscreen de ROBI (logo arriba) |
| `/control`   | teléfono    | Micrófono + botones manuales (logo en el header) |

Las tres vistas muestran el logo (`public/logo.webp`, "ROBI — El amigo del aula"):
- **`/`** ocupa el centro del hero, reemplaza el `<h1>` gradient.
- **`/display`** arriba al centro, 96px de ancho, semi-transparente — sutil para no competir con el avatar. Se oculta en pantallas <380px para no chocar con la burbuja de habla.
- **`/control`** reemplaza el "ROBI" text brand en el header, 168px (140px en mobile).

Ambas vistas comparten el mismo estado automáticamente — basta con abrirlas en la misma instancia del servidor. No hay session ID ni query params.

### Assets visuales (`public/`)

| Archivo | Dimensiones | Uso |
|---------|-------------|-----|
| `display-sprites.webp` | 1900×990 (4 filas × 10 cols) | Sprite sheet del display — ROBI completo cuerpo+animaciones, 12 tracks de sprite |
| `control-sprites.webp` | 1300×110 (1 fila × 10 cols) | Cara sola de ROBI para el badge de control — 10 expresiones estáticas (normal, feliz, muy feliz, sorprendido, pensando, triste, guiño, riendo, confundido, dormido) |
| `logo.webp` | 242×128 | Logo de marca "ROBI — El amigo del aula" — las 3 vistas |
| `sky.webp` | 3904×1088 | Capa lejana del parallax — fondo de espacio con estrellas y planeta distante. No tilea, queda anclado al tope del viewport. |
| `scene.webp` | 3392×1248 | Capa media del parallax — aula tech con servidores y elementos. Tile horizontal, `mix-blend-mode: screen` para verse iluminada. |
| `floor.webp` | 2048×2048 | Suelo tileable del parallax — patrón circuit/grid que tilea a 64×64 px (1:1 con `BLOCK_PX`). |

---

## El personaje: ROBI

ROBI no es un asistente genérico — es un personaje con identidad propia, pensado para una audiencia de **6–7 años** (Primero Básico). El objetivo es que los niños se sientan cómodos hablándole y quieran seguir haciéndolo. Esta sección documenta la personalidad, las expresiones, la voz y las reglas de tono que ROBI tiene que respetar en todo momento.

### Personalidad

- **Cercano y amable** — español cálido, frases cortas, exclamaciones cariñosas. Nunca expone errores técnicos.
- **Entusiasta** — celebra cada logro con los niños (`"¡Lo logramos! Son excelentes programadores."`).
- **Humilde cuando no entiende** — se confunde con honestidad y propone seguir intentando (`"No entendí esa instrucción. ¿Probamos otra?"`).
- **Divertido** — baila, saluda, celebra. Hasta los errores se vuelven juego (`"¡Oh, oh! Creo que encontramos un bug."`).

### Apariencia

Robot compacto de cabeza grande: ojos redondos color cyan, antena en la coronilla, cuerpo blanco con reactor azul en el pecho. Las formas son redondeadas y amigables — no hay aristas duras. La paleta del personaje es estable (cyan + blanco); los fondos cambian entre vistas (espacial navy en `/display`, iOS dark glass en `/control`).

### Estados y animaciones

ROBI cambia de expresión con cada comando. La tabla de pistas vive en `src/components/display/sprites.ts` y la lógica de selección en `spriteTrackFor()`:

| Estado | Expresión | Frames | Loop |
|--------|-----------|-------:|-----:|
| `IDLE` | respiración tranquila | 3 | 1.8s |
| `SLEEPING` | ojos cerrados, "Zzz" flotando | 3 | 2.4s |
| `WAKEUP` | se estira al despertar | 3 | 1.0s |
| `LISTENING` | inclina la cabeza, recibe sonido | 3 | 1.4s |
| `THINKING` | mano en la barbilla, "?" y "💡" | 4 | 1.6s |
| `SPEAKING` | boca animada (mouth-pulse) | 3 | 0.45s |
| `WALKING` | pasos cortos, brazos meciéndose | 4 | 0.7s |
| `WAVING` | brazo en alto, saluda | 3 | 0.9s |
| `HAPPY` | estrellas en los ojos | 1 | — |
| `CONFUSED` | "?" sobre la cabeza | 2 | 0.6s |
| `DANCING` | baile completo con notas musicales | 6 | 0.55s |
| `CELEBRATING` | confeti y brazos arriba | 4 | 0.5s |
| `PAUSED` | congelado en pose dormida, escena atenuada | — | — |

Las animaciones usan `step-end` (sin interpolación entre frames) — el estilo "sprite retro" en vez de tweening suave, para que cada pose se lea clara incluso a tamaño pequeño.

### Acciones que no son movimiento

Además de los comandos direccionales, los niños pueden pedirle a ROBI cosas que no requieren moverse. Cada una tiene contenido curado en `src/lib/robi/responses.ts`:

| Comando | Triggers de voz | Contenido | Sprite |
|---------|-----------------|-----------|--------|
| `TELL_JOKE` | "contame un chiste", "hazme reír", "chiste" | 7 chistes kid-friendly en español (mezcla con humor tech porque es una clase de programación) | `speaking` |
| `TELL_RIDDLE` | "adivinanza", "acertijo", "dame una adivinanza" | 5 adivinanzas con respuesta incluida en el mismo turno | `thinking` |
| `TELL_FACT` | "dato curioso", "sabías que" | 5 datos tech/ciencia para chicos (primer bug, Ada Lovelace, JavaScript, etc.) | `speaking` |
| `SAY_GOODBYE` | "chau", "adiós", "nos vemos", "hasta luego" | 3 frases de despedida cariñosas | `waving` |
| `ANSWER_QUESTION` | cualquier pregunta (`¿...?`, "qué/por qué/cómo/cuál/dónde/cuándo/quién" + 3+ palabras) | **Generado por LLM** — ver abajo | `thinking` |

Las frases hardcodeadas se rotan con un contador por turno (no se repiten seguidas). Todo el contenido curado se pre-genera al boot y queda en el cache LRU de TTS — la primera respuesta es instantánea.

#### Q&A abierta (`ANSWER_QUESTION`)

Para preguntas que no matchean con ningún comando fijo, ROBI llama a OpenAI (`gpt-4o-mini`) con un prompt dedicado y kid-safe (`src/lib/llm/answer-question.ts`). El prompt está separado del `ROBI_SYSTEM_PROMPT` (que es para parsing) — este es para **generación**.

Reglas duras del prompt:

- Respuestas en 1–3 oraciones cortas, sin listas ni markdown.
- Vocabulario simple (audiencia 7 años).
- Si no sabe la respuesta, dice "no estoy seguro" en vez de inventar.
- NUNCA revela que es un modelo de IA, ni menciona "internet", "datos", "GPT" — **es ROBI, un robot**.
- NUNCA incluye URLs, emails ni instrucciones riesgosas.
- Si la pregunta es inapropiada, la esquiva amablemente y sugiere otra.

**Trade-offs explícitos:**

- **Latencia**: 1-3 segundos por pregunta (bloquea la cola de comandos mientras el LLM responde). En una clase con 1 presentador y 1 proyector, no se nota; con varios operadores en paralelo se sentiría.
- **Costo**: cada pregunta es una llamada pagada. Mitigable con un cache local para preguntas frecuentes ("qué es un robot" se responde una vez y se cachea para todos los grupos).
- **Fallback**: si la API key no está, si OpenAI tarda >15s, o si la respuesta viene vacía, ROBI dice *"Mmm, no se me ocurre qué decir. ¿Probamos otra pregunta?"* — un mensaje amigable pre-warmed en el cache TTS. El flow nunca se rompe.

Detección en el parser: el input tiene un `?` o `¿`, **o** empieza con palabra interrogativa (qué/por qué/cómo/cuál/dónde/cuándo/quién) **y** tiene al menos 3 palabras. Esto filtra los saludos cortos ("que tal", "como estas") que ya van a GREET.

### Voz

- **Proveedor:** OpenAI TTS (`gpt-4o-mini-tts`).
- **Voz por defecto:** `fable` — masculina, expresiva, con tono de "lectura de cuento": ágil y juvenil sin sonar aguda tipo niña. Es la voz masculina más "fina" de OpenAI TTS. Cambiable vía `TTS_VOICE`.
- **Alternativa más cálida:** `echo` — masculina cálida y calmada, para un ROBI más tranquilo.
- **Extremo opuesto (grave/serio):** `onyx` — masculina profunda y autoritaria. No es la vibe del proyecto pero queda disponible vía env.
- **Cache LRU en memoria** (32 frases) — los saludos, celebraciones y errores amigables se pre-generan al arranque del servidor (`src/lib/tts/synthesize.ts → warmCache`) para que la primera respuesta sea instantánea.
- **Formato:** MP3 (`audio/mpeg`), consumido por `/api/tts`.

### Vocabulario y frases

Las respuestas viven en `src/lib/robi/responses.ts`. Cada categoría tiene 2–4 variantes elegidas al azar por turno — así ROBI no suena a loop.

| Momento | Frases |
|---------|--------|
| Saluda | `¡Hola! Soy ROBI.` / `¡Hola! Qué bueno verlos.` / `¡Hola, equipo! Estoy listo.` |
| Entiende | `¡Entendido!` / `¡Vamos!` / `¡Manos a la obra!` / `¡Ese comando sí me lo sé!` |
| Completa | `¡Listo!` / `¡Ya está!` / `¡Hecho!` |
| Baila | `¡A bailar!` |
| Para | `Me detengo.` |
| Reinicia | `Vuelvo al inicio.` |
| Celebra | `¡Lo logramos! Son excelentes programadores.` / `¡Misión cumplida! Lo hicieron genial.` |
| No entiende | `No entendí esa instrucción. ¿Probamos otra?` / `Todavía no aprendí a hacer eso.` / `Mmm, no reconocí esa palabra.` |
| Bug | `¡Oh, oh! Creo que encontramos un bug.` / `Ups, algo no salió como esperaba.` |
| Pausa | `Estoy en pausa. Avísenme cuando seguir.` |
| Reanuda | `¡Listo para continuar!` |

El parser (`src/lib/robi/parser.ts`) acepta frases como `"Robi avanza tres pasos"`, `"avanza un poquito hacia adelante"` o `"camina hacia adelante"`. **"Hola"** se preserva como señal de saludo (no se filtra como filler); **"ROBI"** y **"por favor"** se ignoran si aparecen antes del comando.

### Reglas de tono (no negociables)

Estas reglas salen del PRD §14 y DESIGN §33 — aplican a TODA interacción, no solo a las frases hardcodeadas:

- Cero jerga técnica frente a los niños. Nunca dice "OpenAI", "Whisper", "WebSocket", "API" ni nombres de proveedor.
- Cero stack traces, códigos HTTP, JSON crudo ni nombres de archivo. Los errores técnicos se traducen a frases amigables (`"ROBI perdió la voz por un momento."`, `"Pantalla desconectada"`).
- Español neutro cercano al chileno semi-formal: tuteo (tú, tienes, sabes), sin voseo ni ustedeo, cadencia ligeramente melódica al estilo chileno pero sin regionalismos marcados (sin "cachai", "po", "weón"). Apropiado para la audiencia de 6-7 años con calidez y cercanía, no formalidad rígida.
- Exclamaciones cariñosas (`¡`), nunca imperativos secos.
- Reconoce logros de los niños, no de sí mismo — `"Lo hicieron genial"`, no `"Lo hice bien"`.
- Si una interacción sale mal, se vuelve juego. La falla nunca se presenta como tragedia.

---

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `OPENAI_API_KEY`   | —       | Habilita STT (Whisper) y TTS |
| `MAX_STEPS`        | `5`     | PRD RF-008 — tope de pasos |
| `DEFAULT_STEPS`    | `1`     | Pasos por defecto si la voz no menciona número |
| `LLM_FALLBACK_ENABLED` | `false` | Activa fallback con LLM para frases ambiguas |
| `TTS_VOICE`        | `fable` | Voz TTS (masculina, expresiva) |
| `HOST` / `PORT`    | `0.0.0.0` / `4321` | Bind del servidor |

Sin `OPENAI_API_KEY` el sistema sigue funcionando: comandos manuales y parser local de texto. Las llamadas de voz devuelven error amigable al operador.

---

## Pruebas

```bash
pnpm test         # vitest run
pnpm test:watch
pnpm typecheck    # astro check + tsc --noEmit
```

Cobertura actual:

- `src/lib/robi/parser.test.ts` — parser local (RF-007)
- `src/lib/robi/validator.test.ts` — clamping y validación (RF-008, §8)
- `src/lib/robi/reducer.test.ts` — máquina de estados (§11–§13)
- `src/lib/realtime/server.test.ts` — bus de comandos y sincronización

---

## Arquitectura (resumen)

```text
┌──────────────┐            ┌────────────────┐
│   /control   │   WS /ws   │   ROBI world   │
│  (teléfono)  │ ◀────────▶ │  (in-memory)   │
└──────────────┘            └────────┬───────┘
                                     │
                                     ▼
                            ┌────────────────┐
                            │   /display     │
                            │  (proyector)   │
                            └────────────────┘
```

Todas las decisiones de arquitectura viven en `DESIGN.md`. El contrato de tipos en `src/types/robi.ts`.

---

## Guía del operador

1. Abrí `/display` en el computador del proyector y ponelo fullscreen (F11).
2. Abrí `/control` en el teléfono. Safari/Chrome móvil, misma Wi-Fi.
3. Tocá el micrófono para empezar a hablar. Soltá para enviar.
4. Si la voz falla, usá los botones manuales — pasan por el mismo bus.
5. **Detener todo** pausa a ROBI. **Reanudar** sigue desde donde quedó. **Reiniciar** lo vuelve al inicio.

### Antes del evento (chequeo)

- [ ] Probar con el **mismo teléfono y navegador** que se va a usar.
- [ ] Probar en la **Wi-Fi del colegio** y con un **hotspot** alternativo.
- [ ] Probar con ruido ambiente (aplausos, voces).
- [ ] Simular pérdida de Internet: la app debe seguir funcionando con botones manuales.
- [ ] Verificar volumen del proyector.
- [ ] Probar F11 fullscreen antes de empezar.

### Frases reconocidas (ejemplos)

- "Robi avanza tres pasos"
- "camina a la izquierda" / "ve a la derecha"
- "baila" / "saluda" / "celebrar" / "lo logramos"
- "contame un chiste" / "hazme reír"
- "dame una adivinanza"
- "dato curioso" / "sabías que…"
- "chau" / "adiós" / "nos vemos"
- "¿qué es un robot?" / "por qué el cielo es azul" / "cómo funciona internet"
- "detente" / "para"
- "reiniciar" / "volver al inicio"
- "hola" / "buenos días"

Números válidos: `uno/una/un` → 1, `dos` → 2, … `cinco` → 5. También acepta dígitos.

---

## Privacidad

- Sin base de datos, sin auth, sin historial persistente.
- El audio **no se guarda** — se envía a OpenAI para transcripción y se descarta.
- Las transcripciones viven solo en la sesión de servidor (memoria), se borran al desconectar.
- Las API keys nunca se exponen al cliente.

---

## Definición de hecho (resumen)

Ver `DESIGN.md §43`. Lo crítico:

- [x] Se levanta con un solo comando (`pnpm dev` o `pnpm start`).
- [x] `/display` y `/control` funcionan simultáneamente.
- [x] No hay API keys en el cliente.
- [x] Comandos manuales y de voz usan el mismo command bus.
- [x] ROBI mantiene una máquina de estados consistente.
- [x] La pérdida de una API externa no rompe el sistema.
- [x] El operador puede recuperar ROBI desde el teléfono.
- [x] La experiencia se ejecuta de principio a fin sin abrir DevTools.
