# TELL_RIDDLE

Contar una adivinanza. El niño dice "dame una adivinanza" / "ROBI acertijo".

## TL;DR

Comando de contenido con preámbulo + adivinanza + gap de 1.2s. **Sprite = `thinking`** (mano en la barbilla) en lugar de `speaking` — la adivinanza requiere pensar.

## Forma

```ts
{ type: "TELL_RIDDLE" }
```

## Disparador

### Parser local (`src/lib/robi/parser.ts:104`)

```ts
{ cmd: "TELL_RIDDLE", test: /\b(adivinanza|adivinanzas|acertijo|acertijos|dame una adivinanza)\b/ }
```

## Audio (preámbulo + adivinanza)

Dos SAYs:

| # | Categoría | Archivos |
|---|---|---|
| 1 (preámbulo) | `TELL_RIDDLE_PREAMBLE` | `public/audio/riddle-preamble-{01,02}.mp3` |
| 2 (adivinanza) | `RIDDLE` | `public/audio/riddle-{01..05}.mp3` (5 entries) |

Gap: 1200ms (igual que TELL_JOKE/FACT).

## State machine

Idéntico a [TELL_JOKE](./tell-joke.md#state-machine) excepto sprite.

`actionAnimationMs(TELL_RIDDLE) = 0` (content command).

## Sprite track

**`thinking`** (track, 4 frames, 1.6s loop) — la mano en la barbilla, dudando, hasta que el kid piense la respuesta.

> Decisión de UX: a diferencia del chiste (que se "narra"), la adivinanza tiene un momento de "pensá vos" implícito. El sprite `thinking` lo refleja.

## Flujo del servidor

Idéntico a TELL_JOKE — rama dedicada en `server.ts:185-216`.

## Edge cases, Diagnóstico, Puntos de tweak

Iguales a [TELL_JOKE](./tell-joke.md). Solo cambia sprite y nombres de archivos.

## Dependencias

- `src/types/robi.ts:23`
- `src/lib/robi/parser.ts:104`
- `src/lib/robi/responses.ts:59, 198-209`
- `src/lib/realtime/server.ts:185-216`
- `src/components/display/sprites.ts:229` (TELL_RIDDLE → `thinking`)
- `sonidos/audios/riddle-preamble-{01,02}.mp3` + `riddle-{01..05}.mp3`

## Tests

- `src/lib/realtime/server.test.ts`:
  - "TELL_RIDDLE broadcasts a riddle-preamble then the riddle"
