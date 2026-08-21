# docs/

Wiki-LLM de ROBI. Punto de entrada para entender el proyecto, encontrar el archivo correcto, y hacer cambios sin perderse.

## Cómo usar esta wiki

1. **Lee primero** este README para el mapa del proyecto.
2. **Si estás tocando un comando específico** (WALK_LEFT, ANSWER_QUESTION, etc.) → ve directo a `actions/<nombre>.md`. Cada acción es auto-contenida.
3. **Si estás tocando algo global** (state machine, audio catalog, sprite system, realtime) → ve a `references.md`.
4. **Si necesitas entender el QUÉ/HACER del producto** → `PRD.md`. Si necesitas el CÓMO técnico → `DESIGN.md`. Si necesitas los textos de la voz → `scripts.md`.

Cada archivo tiene la misma estructura interna (mismo template por sección) para que un LLM pueda navegar predeciblemente.

---

## Índice

### Producto y arquitectura

| Archivo | Para qué sirve |
|---|---|
| [`PRD.md`](./PRD.md) | Requisitos de producto, audiencia, principios, alcance del MVP, métricas. **Empieza acá** si es la primera vez. |
| [`DESIGN.md`](./DESIGN.md) | Arquitectura técnica: stack, capas, decisiones, trade-offs. El "cómo se hizo". |
| [`scripts.md`](./scripts.md) | Guion de voz de ROBI: textos por acción + instrucciones para OpenAI TTS. |
| [`AGENTS.md`](./AGENTS.md) | Notas para agentes de IA que trabajen en este codebase. Invariantes no-obvios, gotchas. |

### Referencia global

| Archivo | Para qué sirve |
|---|---|
| [`references.md`](./references.md) | State machine, audio catalog, sprite system, realtime WS, patterns comunes, configuración, mapa de archivos. **El lugar al que ir cuando un comando referencia algo cross-cutting.** |

### Comandos (uno por archivo)

14 archivos, uno por `RobiCommand`:

- [`actions/walk-left.md`](./actions/walk-left.md) — caminar a la izquierda
- [`actions/walk-right.md`](./actions/walk-right.md) — caminar a la derecha
- [`actions/jump.md`](./actions/jump.md) — saltar en el lugar
- [`actions/stop.md`](./actions/stop.md) — detenerse
- [`actions/greet.md`](./actions/greet.md) — saludo
- [`actions/dance.md`](./actions/dance.md) — bailar
- [`actions/celebrate.md`](./actions/celebrate.md) — celebrar
- [`actions/reset.md`](./actions/reset.md) — volver al origen
- [`actions/tell-joke.md`](./actions/tell-joke.md) — contar chiste
- [`actions/tell-riddle.md`](./actions/tell-riddle.md) — contar adivinanza
- [`actions/tell-fact.md`](./actions/tell-fact.md) — contar dato curioso
- [`actions/say-goodbye.md`](./actions/say-goodbye.md) — despedida
- [`actions/answer-question.md`](./actions/answer-question.md) — ⭐ respuesta a pregunta abierta (única con LLM runtime)
- [`actions/unknown.md`](./actions/unknown.md) — fallback cuando nada matchea

---

## Convenciones usadas en todos los archivos

- **T = momento del evento**. T=0 es cuando el comando entra a `drainQueue()`.
- **Disparador** = cómo el parser detecta el comando (regex o LLM).
- **Forma** = tipo TypeScript literal del `RobiCommand`.
- **Audio** = categoría del catálogo + archivos + texto de muestra.
- **State machine** = tabla T-order: paso → evento del reducer → estado → sprite track.
- **Posición/dirección** = cambios inmediatos vs deferidos.
- **Flujo del servidor** = qué hace `drainQueue()` específicamente para este caso, con line refs.
- **Sprite track** = id, row, col, frames, duration, comportamiento visual.
- **Edge cases** = qué puede salir mal.
- **Diagnóstico de ruido** = fuentes comunes de comportamiento raro; cómo verificar.
- **Puntos de tweak** = archivos específicos a tocar para cada tipo de cambio.
- **Dependencias** = archivos que referencian este comando.
- **Tests** = nombres exactos de tests que lo cubren.

Cuando un archivo de acción dice "ver [references.md](./references.md#algo)", el ancla `#algo` existe. Si no, hay un link roto: avisame.

---

## Estado de la wiki

Mantener los archivos de acción sincronizados con el código es responsabilidad de quien toca el código. Si hacés un cambio en `src/lib/robi/reducer.ts`, revisá los archivos en `actions/` que correspondan y actualizá la sección "State machine" si las transiciones cambiaron.

Mismas reglas para los archivos de catálogo (`audios.json`) — si agregás una frase, actualizá el `actions/<comando>.md` correspondiente.
