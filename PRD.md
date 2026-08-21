# PRD — ROBI
## Robot interactivo por voz para presentación escolar

**Versión:** 1.0  
**Estado:** MVP  
**Audiencia principal:** Niños y niñas de Primero Básico  
**Objetivo de uso:** Presentación lúdica sobre la profesión de Ingeniero de Software

---

## 1. Resumen

ROBI es una experiencia interactiva diseñada para explicar, de forma lúdica y simple, qué hace un Ingeniero de Software.

En vez de realizar una presentación tradicional, los niños interactúan con un robot animado llamado **ROBI**, al cual pueden saludar y dar órdenes mediante la voz.

ROBI escucha instrucciones habladas, interpreta comandos simples, ejecuta animaciones en una pantalla proyectada y responde utilizando síntesis de voz.

La experiencia debe transmitir tres ideas principales:

1. Un programador entrega instrucciones.
2. Un computador sigue instrucciones.
3. Si una instrucción no funciona como esperamos, podemos corregirla.

El proyecto debe privilegiar simplicidad, confiabilidad y una experiencia entretenida por sobre sofisticación técnica.

---

## 2. Problema

Una explicación tradicional sobre desarrollo de software puede resultar demasiado abstracta para niños de aproximadamente 6–7 años.

Conceptos como programación, algoritmos, aplicaciones, backend o sistemas son difíciles de comprender sin una representación concreta.

ROBI transforma esos conceptos en una experiencia tangible:

- Los niños hablan.
- ROBI escucha.
- ROBI interpreta.
- ROBI ejecuta.
- ROBI responde.

Esto permite demostrar programación como una secuencia de instrucciones sin necesidad de enseñar código.

---

## 3. Objetivo principal

Crear una experiencia web interactiva donde los niños puedan controlar mediante comandos de voz a un robot animado proyectado en pantalla.

---

## 4. Objetivos secundarios

- Presentar la profesión de Ingeniero de Software de manera entretenida.
- Mantener a los niños participando activamente.
- Introducir intuitivamente los conceptos de instrucción, programa, error y corrección.
- Permitir que ROBI responda a saludos y frases simples.
- Minimizar los elementos técnicos visibles durante la presentación.
- Disponer de controles manuales de respaldo.
- Evitar dependencias innecesarias o arquitectura sobredimensionada.

---

## 5. Principios de producto

### 5.1 Simple para los niños

La interfaz proyectada debe mostrar principalmente a ROBI.

No debe exponer:

- logs,
- paneles administrativos,
- transcripciones,
- botones técnicos,
- nombres de APIs,
- estados internos.

### 5.2 Controlable por el presentador

La interfaz del teléfono debe permitir observar y controlar el sistema.

Debe existir fallback manual para continuar la actividad aunque el reconocimiento de voz falle.

### 5.3 ROBI es un personaje

ROBI no debe comportarse como un asistente genérico.

Debe tener:

- nombre propio,
- personalidad amigable,
- respuestas cortas,
- vocabulario apropiado para niños,
- animaciones expresivas.

### 5.4 Robustez antes que inteligencia

No es necesario que ROBI interprete lenguaje arbitrario.

Es preferible reconocer correctamente un conjunto reducido de intenciones que intentar mantener conversaciones abiertas.

---

## 6. Usuarios

### 6.1 Usuario primario

**Niño o niña de Primero Básico**

Interacción:

- habla con ROBI,
- entrega instrucciones,
- observa su comportamiento,
- participa en juegos grupales.

### 6.2 Usuario operador

**Presentador**

Interacción:

- abre la vista de control en su teléfono,
- activa o desactiva el micrófono,
- observa la transcripción,
- revisa el comando interpretado,
- ejecuta comandos manualmente,
- silencia o reinicia ROBI cuando sea necesario.

---

## 7. Experiencia esperada

### 7.1 Inicio

La pantalla proyectada muestra a ROBI dormido.

El presentador dice:

> "Creo que ROBI está dormido. ¿Lo despertamos?"

Los niños gritan:

> "¡ROBI!"

ROBI despierta y responde:

> "¡Hola! ¿Cómo están?"

### 7.2 Primera interacción

El presentador explica:

> "ROBI necesita instrucciones para saber qué hacer."

Un niño dice:

> "ROBI, avanza."

ROBI avanza visualmente.

### 7.3 Introducción del concepto de error

Un niño entrega una instrucción incompleta o ROBI realiza deliberadamente una acción incorrecta.

ROBI puede responder:

> "¡Oh, oh! Creo que tenemos un bug."

El presentador explica brevemente que un bug es un problema que debe corregirse.

### 7.4 Cierre

ROBI celebra cuando completa una misión.

Ejemplo:

> "¡Lo logramos! Son excelentes programadores."

ROBI ejecuta una animación de celebración o baile.

---

# 8. Alcance del MVP

## 8.1 Incluido

- Aplicación web monolítica.
- Astro.
- React.
- TypeScript.
- Vista proyectada de ROBI.
- Vista de control desde teléfono.
- Captura de micrófono.
- Transcripción de voz.
- Interpretación de comandos.
- Ejecución de acciones visuales.
- TTS mediante API.
- Sincronización en tiempo real entre control y pantalla.
- Respuestas predefinidas o acotadas.
- Controles manuales.
- Estados visuales de ROBI.
- Manejo de errores básicos.
- Modo seguro ante pérdida de conexión.

## 8.2 Fuera de alcance

- Cuentas de usuario.
- Autenticación.
- Base de datos.
- Administración multiusuario.
- Historial persistente.
- Chatbot conversacional completo.
- Navegación autónoma compleja.
- Modelos 3D avanzados.
- Visión computacional.
- Reconocimiento facial.
- Aplicación móvil nativa.
- Microservicios.
- Kubernetes.
- Panel administrativo avanzado.

---

# 9. Requisitos funcionales

## RF-001 — Vista proyectada

El sistema debe proporcionar una vista dedicada para proyección.

Ruta sugerida:

`/display`

Debe mostrar:

- ROBI,
- animaciones,
- estados visuales,
- opcionalmente mensajes simples para los niños.

No debe mostrar controles administrativos.

---

## RF-002 — Vista de control

El sistema debe proporcionar una vista optimizada para teléfonos.

Ruta sugerida:

`/control`

Debe mostrar:

- estado de conexión,
- estado del micrófono,
- transcripción actual,
- último comando interpretado,
- último comando ejecutado,
- controles manuales,
- botón de emergencia.

---

## RF-003 — Captura de voz

La vista de control debe permitir utilizar el micrófono del teléfono.

Debe existir:

- iniciar escucha,
- detener escucha,
- indicador visible de escucha.

---

## RF-004 — Transcripción

La aplicación debe transformar voz en texto.

La transcripción debe mostrarse únicamente en la vista de control.

Ejemplo:

`ROBI avanza tres pasos`

---

## RF-005 — Interpretación de comandos

La aplicación debe transformar la transcripción en una estructura interna tipada.

Ejemplo:

```json
{
  "type": "MOVE_FORWARD",
  "steps": 3
}
```

---

## RF-006 — Comandos mínimos

ROBI debe comprender como mínimo:

- avanzar,
- retroceder opcionalmente,
- girar a la izquierda,
- girar a la derecha,
- detenerse,
- saludar,
- bailar,
- celebrar,
- volver a posición inicial.

---

## RF-007 — Variaciones de lenguaje

El sistema debe reconocer variaciones naturales.

Ejemplos equivalentes:

- "avanza"
- "avanza un paso"
- "camina hacia adelante"
- "ROBI avanza"
- "ROBI avanza tres pasos"

---

## RF-008 — Límites

La cantidad de pasos debe restringirse.

Valor sugerido:

- mínimo: 1
- máximo: 5

Esto evita secuencias demasiado largas o accidentales.

---

## RF-009 — Comando desconocido

Si una instrucción no puede interpretarse, ROBI debe responder de forma amigable.

Ejemplos:

> "No entendí esa instrucción. ¿Probamos otra?"

> "Todavía no aprendí a hacer eso."

No debe mostrar errores técnicos.

---

## RF-010 — Saludos

ROBI debe responder a saludos simples.

Ejemplos:

- hola,
- hola ROBI,
- buenos días,
- ¿cómo estás?

---

## RF-011 — TTS

ROBI debe poder reproducir respuestas habladas mediante síntesis de voz.

La voz debe mantenerse consistente durante toda la experiencia.

---

## RF-012 — Animación mientras habla

Mientras se reproduce TTS, ROBI debe entrar en estado `SPEAKING`.

La animación puede incluir:

- movimiento de boca,
- ojos,
- balanceo,
- ondas de voz.

No se requiere sincronización fonética exacta.

---

## RF-013 — Ejecución visual

Los comandos deben generar cambios visibles en la vista proyectada.

Ejemplos:

- caminar,
- rotar,
- detenerse,
- bailar,
- celebrar.

---

## RF-014 — Sincronización

La vista de control debe poder enviar comandos a la vista proyectada en tiempo real.

Latencia percibida objetivo:

menos de 1 segundo en red local o conexión estable, excluyendo procesamiento externo de voz/TTS.

---

## RF-015 — Controles manuales

La vista de control debe incluir:

- Avanzar
- Izquierda
- Derecha
- Detener
- Bailar
- Saludar
- Inicio
- Silenciar
- Pausar

---

## RF-016 — Modo emergencia

Debe existir una acción única que:

- detenga animaciones,
- detenga audio,
- deje ROBI en estado estable,
- permita continuar manualmente.

---

# 10. Estados de ROBI

Estados mínimos:

- `SLEEPING`
- `IDLE`
- `LISTENING`
- `THINKING`
- `SPEAKING`
- `EXECUTING`
- `CONFUSED`
- `CELEBRATING`
- `PAUSED`

---

# 11. Personalidad de ROBI

ROBI debe ser:

- amistoso,
- curioso,
- alegre,
- ligeramente gracioso,
- paciente.

Las respuestas deben ser cortas.

Preferentemente menos de 15 palabras.

Ejemplos:

> "¡Hola! Soy ROBI."

> "¡Entendido!"

> "¡Vamos!"

> "¡Ese comando sí me lo sé!"

> "¡Oh, oh! Creo que encontramos un bug."

---

# 12. Requisitos no funcionales

## RNF-001 — Simplicidad

La solución debe evitar infraestructura que no sea estrictamente necesaria.

## RNF-002 — Rendimiento

Las animaciones deben ejecutarse fluidamente en un navegador moderno.

Objetivo:

60 FPS cuando sea razonable.

## RNF-003 — Mobile first para control

La vista `/control` debe estar optimizada para Safari/Chrome móvil.

## RNF-004 — Fullscreen

La vista `/display` debe funcionar correctamente en pantalla completa.

## RNF-005 — Seguridad

Las API keys nunca deben exponerse al navegador cuando puedan mantenerse en servidor.

## RNF-006 — Resiliencia

Una falla en TTS o Speech-to-Text no debe inutilizar la aplicación completa.

## RNF-007 — Observabilidad mínima

La consola del servidor debe registrar:

- errores de API,
- pérdida de conexión,
- comandos inválidos,
- excepciones.

No se requiere stack externo de observabilidad.

---

# 13. Restricciones

- No usar base de datos.
- No implementar autenticación para el MVP.
- No utilizar microservicios.
- Evitar dependencias pesadas.
- No depender exclusivamente de IA para ejecutar comandos.
- No permitir ejecución arbitraria generada por modelos.
- No almacenar grabaciones de voz por defecto.

---

# 14. Seguridad y privacidad

Dado que la actividad involucra niños:

- evitar almacenamiento persistente de audio,
- evitar almacenamiento persistente de transcripciones,
- no solicitar nombres completos,
- no utilizar reconocimiento facial,
- no realizar identificación biométrica,
- no conservar conversaciones después de la sesión.

El procesamiento debe limitarse a lo estrictamente necesario para ejecutar la experiencia.

---

# 15. Criterios de aceptación del MVP

El MVP se considera funcional cuando:

1. `/display` puede abrirse en un computador y mostrar ROBI.
2. `/control` puede abrirse desde un teléfono.
3. Ambas vistas pueden conectarse.
4. El teléfono puede capturar una orden hablada.
5. La orden puede transcribirse.
6. La transcripción puede transformarse en un comando válido.
7. El comando puede enviarse a la pantalla proyectada.
8. ROBI puede ejecutar la animación correspondiente.
9. ROBI puede responder mediante TTS.
10. Todos los comandos principales pueden ejecutarse manualmente.
11. Una falla de la API de voz no impide continuar manualmente.
12. El sistema puede reiniciarse rápidamente desde el teléfono.

---

# 16. Métricas de éxito

El producto se considera exitoso si durante la presentación:

- los niños entienden que ROBI necesita instrucciones,
- al menos varios niños pueden dar órdenes directamente,
- la mayoría de las órdenes principales son reconocidas correctamente,
- una falla técnica no detiene la actividad,
- la experiencia completa puede realizarse en aproximadamente 15–20 minutos.

---

# 17. Roadmap

## Fase 1 — Núcleo

- Vista `/display`.
- ROBI estático.
- Máquina de estados.
- Comandos manuales.

## Fase 2 — Sincronización

- Vista `/control`.
- Comunicación en tiempo real.
- Ejecución remota de comandos.

## Fase 3 — Voz

- Captura de micrófono.
- Speech-to-Text.
- Parser de comandos.

## Fase 4 — TTS

- Respuestas habladas.
- Estado `SPEAKING`.
- Animación de boca.

## Fase 5 — Experiencia

- Animaciones.
- Dormir/despertar.
- Baile.
- Celebración.
- Mensajes de error amigables.

## Fase 6 — Ensayo

- Prueba con teléfono real.
- Prueba con proyector.
- Prueba con ruido ambiente.
- Simulación sin Internet.
- Validación del fallback manual.

---

# 18. Definición de terminado

ROBI está listo para la presentación cuando puede realizar toda la actividad sin depender de intervención técnica desde un computador.

El presentador debe poder operar la experiencia exclusivamente desde el teléfono mientras la vista proyectada permanece a pantalla completa.
