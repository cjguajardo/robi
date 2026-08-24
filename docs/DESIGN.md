# DESIGN — ROBI
## Diseño técnico del robot interactivo por voz

**Versión:** 1.0  
**Arquitectura:** Monolito Astro + React + TypeScript  
**Objetivo:** Implementación simple, mantenible y robusta para una presentación escolar

---

# 1. Objetivos técnicos

La solución debe:

- ejecutarse como una única aplicación,
- servir tanto la vista proyectada como la vista de control,
- mantener las API keys en servidor,
- sincronizar comandos en tiempo real,
- aislar lógica de ROBI de la interfaz,
- permitir fallback manual,
- continuar operativa ante fallas parciales,
- evitar infraestructura innecesaria.

---

# 2. Stack

## Aplicación

- Astro
- React
- TypeScript

## Tiempo real

Preferencia:

- WebSocket

Alternativa:

- Server-Sent Events

## Voz

- Speech-to-Text mediante API o capacidad compatible del navegador
- TTS mediante API server-side

## Animaciones

Opciones válidas:

- CSS
- SVG
- React
- Framer Motion opcional

Para el MVP se recomienda evitar motores gráficos complejos.

---

# 3. Arquitectura general

```text
                        ┌─────────────────────┐
                        │     Astro App       │
                        │                     │
                        │  Monolito único     │
                        └──────────┬──────────┘
                                   │
                  ┌────────────────┴────────────────┐
                  │                                 │
          ┌───────▼────────┐                ┌───────▼────────┐
          │   /control     │                │    /display    │
          │                │                │                │
          │ React Island   │                │ React Island   │
          │ teléfono       │                │ proyector      │
          └───────┬────────┘                └───────▲────────┘
                  │                                 │
                  │         tiempo real             │
                  └──────────────┬──────────────────┘
                                 │
                         ┌───────▼────────┐
                         │   ROBI Core    │
                         │                │
                         │ commands       │
                         │ state machine  │
                         │ validation     │
                         └───────┬────────┘
                                 │
                        ┌────────┴────────┐
                        │                 │
                 ┌──────▼─────┐   ┌─────▼──────┐
                 │ Speech API │   │  TTS API   │
                 └────────────┘   └────────────┘
```

---

# 4. Decisión: monolito

La aplicación se implementará como un único proyecto Astro.

No se separará frontend y backend.

Motivos:

- menor complejidad,
- una sola base de código,
- un solo despliegue,
- configuración sencilla,
- menor cantidad de puntos de falla,
- suficiente para el alcance del proyecto.

Astro actuará como:

- servidor HTTP,
- servidor de páginas,
- host de APIs internas,
- coordinador de tiempo real.

React se utilizará exclusivamente donde sea necesaria interactividad.

---

# 5. Estructura propuesta

```text
src/
├── components/
│   ├── display/
│   │   ├── Robi.tsx
│   │   ├── RobiAvatar.tsx
│   │   ├── RobiFace.tsx
│   │   ├── RobiStatus.tsx
│   │   └── RobiSpeechBubble.tsx
│   │
│   └── control/
│       ├── Controller.tsx
│       ├── MicrophoneButton.tsx
│       ├── TranscriptPanel.tsx
│       ├── CommandPanel.tsx
│       └── EmergencyControls.tsx
│
├── layouts/
│   └── BaseLayout.astro
│
├── lib/
│   ├── robi/
│   │   ├── commands.ts
│   │   ├── parser.ts
│   │   ├── reducer.ts
│   │   ├── state.ts
│   │   ├── responses.ts
│   │   └── validator.ts
│   │
│   ├── realtime/
│   │   ├── events.ts
│   │   └── server.ts
│   │
│   ├── speech/
│   │   ├── transcription.ts
│   │   └── types.ts
│   │
│   └── tts/
│       ├── synthesize.ts
│       └── types.ts
│
├── pages/
│   ├── index.astro
│   ├── display.astro
│   ├── control.astro
│   │
│   └── api/
│       ├── interpret.ts
│       ├── transcribe.ts
│       └── tts.ts
│
└── types/
    └── robi.ts
```

---

# 6. Vistas

## 6.1 `/display`

Responsabilidad:

Mostrar la experiencia visual de ROBI.

Debe:

- mantener pantalla completa,
- escuchar eventos del servidor,
- actualizar estado visual,
- reproducir audio TTS,
- ejecutar animaciones.

No debe:

- interpretar lenguaje,
- llamar directamente a modelos,
- contener API keys,
- decidir acciones.

---

## 6.2 `/control`

Responsabilidad:

Controlar la experiencia desde teléfono.

Debe:

- iniciar/detener micrófono,
- enviar audio o transcripciones,
- mostrar transcripción,
- mostrar comando interpretado,
- ejecutar comandos manuales,
- detener ROBI,
- reiniciar ROBI.

---

# 7. Modelo de comandos

El dominio de ROBI debe utilizar comandos tipados.

```ts
export type RobiCommand =
  | {
      type: "MOVE_FORWARD";
      steps: number;
    }
  | {
      type: "MOVE_BACKWARD";
      steps: number;
    }
  | {
      type: "TURN_LEFT";
    }
  | {
      type: "TURN_RIGHT";
    }
  | {
      type: "STOP";
    }
  | {
      type: "GREET";
    }
  | {
      type: "DANCE";
    }
  | {
      type: "CELEBRATE";
    }
  | {
      type: "RESET";
    }
  | {
      type: "UNKNOWN";
      raw?: string;
    };
```

---

# 8. Regla de seguridad del command layer

Ningún modelo de lenguaje o servicio externo puede ejecutar código directamente.

Un servicio externo solo puede producir una intención que posteriormente será:

1. parseada,
2. validada,
3. normalizada,
4. transformada en `RobiCommand`.

Ejemplo:

```text
"Robi avanza tres pasos"
          │
          ▼
       parser
          │
          ▼
{
  type: "MOVE_FORWARD",
  steps: 3
}
          │
          ▼
      validator
          │
          ▼
     command bus
```

---

# 9. Parser

El parser debe favorecer reglas deterministas antes de acudir a un LLM.

Ejemplos:

```text
/avanza/
/adelante/
/camina/

/izquierda/
/derecha/

/baila/
/saluda/
/detente/
```

Números deben convertirse a enteros.

Ejemplos:

- uno → 1
- dos → 2
- tres → 3
- cuatro → 4
- cinco → 5

---

# 10. Estrategia híbrida de interpretación

Orden recomendado:

## Nivel 1

Regex, keywords y reglas.

Ventajas:

- cero latencia externa,
- cero costo,
- comportamiento predecible.

## Nivel 2

LLM opcional únicamente si el parser local devuelve `UNKNOWN`.

Ejemplo:

```text
"Robi, camina un poquito para adelante"
```

Salida esperada del LLM:

```json
{
  "type": "MOVE_FORWARD",
  "steps": 1
}
```

El resultado debe validarse exactamente igual que cualquier entrada local.

---

# 11. Máquina de estados

```ts
export type RobiState =
  | "SLEEPING"
  | "IDLE"
  | "LISTENING"
  | "THINKING"
  | "SPEAKING"
  | "EXECUTING"
  | "CONFUSED"
  | "CELEBRATING"
  | "PAUSED";
```

---

# 12. Transiciones

```text
SLEEPING
   │
 wake
   ▼
IDLE
   │
 microphone active
   ▼
LISTENING
   │
 phrase completed
   ▼
THINKING
   │
 command
   ├───────────── unknown ─────────────► CONFUSED
   │
   ▼
EXECUTING
   │
 completed
   ▼
IDLE
```

Habla:

```text
ANY STATE
   │
 TTS start
   ▼
SPEAKING
   │
 audio ended
   ▼
previous / IDLE
```

Emergencia:

```text
ANY STATE
   │
 PAUSE
   ▼
PAUSED
```

---

# 13. State reducer

Se recomienda manejar cambios de estado mediante reducer.

```ts
type RobiEvent =
  | { type: "WAKE" }
  | { type: "LISTEN" }
  | { type: "THINK" }
  | { type: "SPEAK" }
  | { type: "EXECUTE"; command: RobiCommand }
  | { type: "ERROR" }
  | { type: "COMPLETE" }
  | { type: "PAUSE" }
  | { type: "RESET" };
```

Esto evita múltiples estados booleanos incompatibles.

Evitar:

```ts
isSpeaking
isWalking
isThinking
isSleeping
isPaused
```

como fuente principal de verdad.

---

# 14. Comunicación en tiempo real

## Decisión recomendada: WebSocket

Aunque SSE podría cubrir gran parte del caso, WebSocket ofrece una conexión bidireccional sencilla entre:

- teléfono,
- servidor,
- pantalla.

El wire format es `RealtimeEvent` — un union discriminado por `type`. Definido en `src/types/robi.ts` (fuente única de verdad). No hay sobre (envelope): cada mensaje es literalmente `{type, payload}`.

Categorías:

- **Cliente → servidor:** `COMMAND`, `TRANSCRIPT`, `RESET`, `PAUSE`, `RESUME`.
- **Servidor → todos los peers:** `SNAPSHOT` (al conectar), `STATE_CHANGED`, `COMMAND` (eco), `SAY`, `RESET`, `PAUSE`, `RESUME`, `SPEECH_STARTED`, `SPEECH_ENDED`.

---

# 15. Single shared world

**No hay sesiones. No hay session ID. No hay query params.**

Cada proceso del servidor mantiene un único `RobiWorld` en memoria (`src/lib/realtime/server.ts`). Las vistas se conectan al WebSocket en `/ws` (sin params) y comparten ese mundo. Si necesitás aislar dos setups en la misma red, levantá el servidor en otro puerto (`PORT=4322 pnpm start`).

Decisiones que esto descarta a propósito:

- `Map<sessionId, Session>` → un solo objeto `state` módulo-privado.
- `?session=…` en la URL → ignorado; se conecta tal cual.
- Wire envelope `{session, event}` → mensajes son `{type, payload}` puros.
- `WireMessage`, `isWireMessage()`, `wire()` helpers → borrados.

Lo que sobrevive: el reducer, el command queue, el broadcaster, el reducer state machine. Toda la lógica de dominio; cero la parafernalia de routing.

---

# 16. Speech-to-Text

Se contemplan dos estrategias.

## Estrategia A — Web Speech API

Ventajas:

- implementación rápida,
- bajo costo,
- poca infraestructura.

Desventajas:

- soporte variable,
- comportamiento dependiente del navegador,
- Safari puede presentar diferencias.

## Estrategia B — API server-side

Flujo:

```text
microphone
   │
   ▼
audio
   │
   ▼
Astro endpoint
   │
   ▼
Speech API
   │
   ▼
transcript
```

Para la presentación real debe probarse específicamente en el teléfono que será utilizado.

---

# 17. Endpoint `/api/transcribe`

Responsabilidad:

Transformar audio en texto.

Entrada:

```text
multipart/form-data
```

Salida:

```json
{
  "text": "Robi avanza tres pasos"
}
```

Errores deben regresar estructura consistente.

```json
{
  "error": {
    "code": "TRANSCRIPTION_FAILED",
    "message": "Could not transcribe audio"
  }
}
```

---

# 18. Endpoint `/api/interpret`

Entrada:

```json
{
  "text": "Robi avanza tres pasos"
}
```

Salida:

```json
{
  "command": {
    "type": "MOVE_FORWARD",
    "steps": 3
  },
  "source": "rules"
}
```

`source` puede ser:

- `rules`
- `model`

---

# 19. Endpoint `/api/tts`

Entrada:

```json
{
  "text": "¡Entendido! Avanzo tres pasos."
}
```

Salida:

audio.

Content-Type sugerido:

```text
audio/mpeg
```

o formato equivalente soportado.

---

# 20. TTS

La síntesis de voz debe ejecutarse server-side cuando use credenciales privadas.

Flujo:

```text
response text
     │
     ▼
 /api/tts
     │
     ▼
 TTS provider
     │
     ▼
 audio bytes
     │
     ▼
 /display
```

---

# 21. Cache de frases

Las respuestas frecuentes pueden precargarse o cachearse.

Ejemplos:

- hola,
- entendido,
- vamos,
- no entendí,
- encontramos un bug,
- misión cumplida.

Esto reduce:

- latencia,
- costo,
- dependencia externa.

Para un MVP incluso podrían almacenarse archivos de audio generados previamente.

---

# 22. Respuestas de ROBI

Archivo sugerido:

```text
src/lib/robi/responses.ts
```

Ejemplo:

```ts
export const responses = {
  greeting: [
    "¡Hola! Soy ROBI.",
    "¡Hola! Qué bueno verlos."
  ],

  understood: [
    "¡Entendido!",
    "¡Vamos!"
  ],

  unknown: [
    "No entendí esa instrucción.",
    "Todavía no aprendí a hacer eso."
  ]
};
```

---

# 23. Motor de animación

ROBI debe consumir el estado actual.

Ejemplo:

```tsx
<Robi
  state={state}
  direction={direction}
  position={position}
/>
```

La animación nunca debe decidir comandos.

La responsabilidad es exclusivamente visual.

---

# 24. Modelo de posición

Para el MVP no se necesita física.

```ts
type Direction =
  | "NORTH"
  | "EAST"
  | "SOUTH"
  | "WEST";

interface Position {
  x: number;
  y: number;
}
```

---

# 25. Movimiento

Cada `MOVE_FORWARD` puede actualizar posición lógica y disparar animación.

Ejemplo:

```text
steps = 3

step 1
wait animation

step 2
wait animation

step 3
complete
```

Esto permite que ROBI cuente:

> Uno...

> Dos...

> Tres...

---

# 26. Cola de comandos

Se recomienda mantener una cola simple.

```ts
interface CommandQueue {
  current?: RobiCommand;
  pending: RobiCommand[];
}
```

Mientras ROBI está ejecutando, los nuevos comandos pueden:

- rechazarse, o
- esperar.

Para la presentación se recomienda rechazar nuevos comandos mientras exista uno activo.

Esto simplifica el comportamiento.

---

# 27. Control manual

Los botones del teléfono deben pasar por el mismo command bus.

Incorrecto:

```text
manual button → modificar directamente React state
```

Correcto:

```text
manual button
     │
     ▼
RobiCommand
     │
     ▼
command bus
     │
     ▼
display
```

Así voz y control manual comparten comportamiento.

---

# 28. Modo de emergencia

Botón:

`DETENER TODO`

Debe:

1. cancelar audio,
2. cancelar animación,
3. vaciar command queue,
4. cambiar estado a `PAUSED`,
5. bloquear comandos de voz.

Luego:

`REANUDAR`

o:

`REINICIAR ROBI`.

---

# 29. Comportamiento ante pérdida de conexión

La vista `/display` debe mostrar ROBI en `IDLE`.

La vista `/control` debe indicar:

`🔴 Pantalla desconectada`

Los botones no deben generar errores visibles.

Al reconectar:

- sincronizar estado,
- limpiar comandos viejos,
- regresar a un estado conocido.

---

# 30. Estrategia offline

El sistema debe poder continuar parcialmente sin servicios externos.

Modo offline mínimo:

- botones manuales,
- animaciones,
- audios pre-generados.

Esto permite completar la presentación aunque falle Internet.

---

# 31. API keys

Variables:

```text
OPENAI_API_KEY=
```

o equivalente según proveedor.

Nunca usar:

```text
PUBLIC_OPENAI_API_KEY
```

Nunca enviar credenciales al cliente.

---

# 32. Configuración

Ejemplo:

```ts
export const config = {
  maxSteps: 10,
  defaultSteps: 5,
  speechEnabled: true,
  ttsEnabled: true,
  modelFallbackEnabled: false
};
```

---

# 33. Manejo de errores

Errores técnicos deben registrarse en servidor.

Los niños nunca deben ver:

- stack traces,
- códigos HTTP,
- JSON,
- nombres de proveedores.

Frontend público debe traducirlos.

Ejemplo:

```text
TTS API timeout
```

se convierte en:

> "ROBI perdió la voz por un momento."

---

# 34. Logging

Formato sugerido:

```text
[robi] command=MOVE_FORWARD steps=3
[robi] state=EXECUTING
[ws] connect
[ws] close
[speech] transcription completed 430ms
[tts] synthesis completed 610ms
```

No registrar audio ni información personal.

---

# 35. Testing

## Unit tests

Prioridad:

- parser,
- validator,
- reducer,
- state transitions,
- command mapping.

Ejemplos:

```text
"avanza tres pasos"
→ MOVE_FORWARD 3
```

```text
"avanza cien pasos"
→ MOVE_FORWARD 5
```

```text
"vuela"
→ UNKNOWN
```

---

# 36. Integration tests

Validar:

```text
transcript
→ parser
→ command
→ event
→ state
```

---

# 37. Pruebas manuales críticas

Antes del evento:

- iPhone real,
- navegador real,
- Wi-Fi del colegio,
- hotspot móvil alternativo,
- proyector,
- fullscreen,
- volumen,
- micrófono,
- ruido ambiente,
- pérdida de Internet,
- reconexión,
- fallback manual.

---

# 38. Deployment

El monolito debe desplegarse en un runtime compatible con Astro SSR y WebSocket.

Alternativamente puede ejecutarse localmente en el notebook del presentador y conectarse mediante LAN/hotspot.

Para reducir dependencia del Internet para la interfaz:

- servir recursos localmente,
- evitar CDNs obligatorios,
- precargar assets,
- precargar sonidos básicos.

---

# 39. Estrategia recomendada para el evento

La opción más robusta es:

```text
Notebook
   │
   ├── Astro server
   │
   ├── /display → proyector
   │
   └── Wi-Fi / hotspot
            │
            ▼
          iPhone
        /control
```

Solo las APIs externas requerirían Internet.

Si Internet falla:

```text
manual control
+
cached TTS
+
local animations
```

mantienen la experiencia operativa.

---

# 40. Trade-offs

## Astro + React

Ventaja:

muy poco boilerplate y fácil separación entre páginas estáticas e islas interactivas.

Trade-off:

si toda la aplicación termina siendo altamente interactiva, React puro podría ser más directo.

Para este proyecto Astro sigue siendo suficiente.

---

## WebSocket

Ventaja:

bidireccional y baja latencia.

Trade-off:

requiere runtime que mantenga conexiones persistentes.

---

## Web Speech API

Ventaja:

simplicidad.

Trade-off:

compatibilidad y control reducidos.

---

## Speech API externa

Ventaja:

calidad consistente.

Trade-off:

Internet, latencia y costo.

---

## Parser local

Ventaja:

rápido, barato y predecible.

Trade-off:

menos flexible lingüísticamente.

---

## LLM fallback

Ventaja:

entiende frases naturales.

Trade-off:

latencia, costo y posible variabilidad.

Debe ser opcional.

---

# 41. Decisiones de diseño finales

Para el MVP:

- monolito Astro,
- React Islands,
- TypeScript,
- WebSocket,
- state machine,
- parser local primero,
- LLM solo como fallback opcional,
- TTS server-side,
- sin DB,
- sin auth,
- sin persistencia,
- sin microservicios,
- fallback manual obligatorio,
- audios frecuentes pre-cacheados cuando sea posible.

---

# 42. Orden recomendado de implementación

1. Crear Astro app.
2. Crear `/display`.
3. Dibujar ROBI.
4. Implementar estados.
5. Implementar animaciones.
6. Crear `/control`.
7. Implementar botones manuales.
8. Agregar WebSocket.
9. Compartir comandos.
10. Implementar parser.
11. Implementar micrófono.
12. Implementar Speech-to-Text.
13. Implementar TTS.
14. Agregar cache de frases.
15. Agregar emergency stop.
16. Agregar reconexión.
17. Ensayar offline.
18. Ensayar con ruido real.

---

# 43. Definition of Done técnico

El proyecto está listo cuando:

- puede levantarse con un único comando,
- `/display` y `/control` funcionan simultáneamente,
- no existen API keys en cliente,
- comandos manuales y de voz usan la misma lógica,
- ROBI mantiene una máquina de estados consistente,
- la pérdida de una API externa no rompe el sistema,
- el operador puede recuperar ROBI desde el teléfono,
- la experiencia puede ejecutarse de principio a fin sin abrir herramientas de desarrollo.
