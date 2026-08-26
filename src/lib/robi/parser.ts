// Deterministic command parser.
// Regex/keywords first, LLM only as fallback (see DESIGN.md §9, §10).
// Designed for short, kid-friendly Spanish phrases.

import type { RobiCommand } from "@/types/robi";
import { FALLBACK_CONFIG } from "./commands";

/** Spanish unit words used alone and after "treinta/cuarenta/... y". */
const UNIT_WORDS: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
};

/** Spanish number words that are expressed as one token. */
const DIRECT_NUMBER_WORDS: Record<string, number> = {
  ...UNIT_WORDS,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiun: 21,
  veintiuno: 21,
  veintiuna: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  cien: 100,
};

const TENS_WORDS: Record<string, number> = {
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
};

/** Try to extract a step count from the transcript, otherwise return default. */
function extractSteps(text: string, fallback: number): number {
  // Digits first. The validator owns the upper bound, so the parser must
  // preserve the spoken value instead of silently falling back on 3+ digits.
  const digitMatch = text.match(/\b(\d+)\b/);
  if (digitMatch) return Number(digitMatch[1]);

  const words = text.split(/\s+/);
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (!word) continue;

    const direct = DIRECT_NUMBER_WORDS[word];
    if (direct !== undefined) return direct;

    const tens = TENS_WORDS[word];
    if (tens === undefined) continue;

    const connector = words[index + 1];
    const unitWord = words[index + 2];
    const unit = unitWord ? UNIT_WORDS[unitWord] : undefined;
    if (connector === "y" && unit !== undefined && unit > 0) {
      return tens + unit;
    }
    return tens;
  }
  return fallback;
}

/** Strip filler words and the "ROBI" address prefix.
 *  Note: "hola" is NOT stripped — it's a meaningful signal for GREET. */
function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[¿?!¡.,]/g, " ")
    .replace(/\brobi\b,?/g, " ")
    .replace(/\bpor favor\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect a question intent. Runs BEFORE the pattern loop so questions
 * route to ANSWER_QUESTION regardless of which interrogative word they
 * start with. Two signals:
 *
 *   1. Explicit question mark in the original text (before normalize
 *      strips punctuation). Strongest signal — most kids say "¿...?" with
 *      the inverted marks.
 *   2. Starts with an interrogative word AND has ≥3 words. Filters out
 *      the short forms that GREET already owns ("que tal", "como estas")
 *      while letting "como funciona un robot" or "por que el cielo es
 *      azul" through.
 */
function isQuestionIntent(raw: string, normalized: string): boolean {
  if (/[¿?]/.test(raw)) return true;
  if (/^(que|por que|porque|cual|como|donde|cuando|quien)\b/.test(normalized)) {
    return normalized.split(/\s+/).length >= 3;
  }
  return false;
}

/** Pattern catalogue — most specific patterns first. */
const PATTERNS: Array<{
  cmd: RobiCommand["type"];
  test: RegExp;
  withSteps?: boolean;
}> = [
  // Celebrations — must come before generic verbs because "celebrar" overlaps with "saluda".
  { cmd: "CELEBRATE", test: /\b(celebrar|celebracion|lo logramos|mision cumplida|genial|excelente)\b/ },

  // Dancing.
  { cmd: "DANCE", test: /\b(baila|baile|bailar)\b/ },

  // Greetings.
  { cmd: "GREET", test: /\b(buenos dias|buenas|hola|saluda|saludar|como estas|que tal)\b/ },

  // Reset / home.
  { cmd: "RESET", test: /\b(reiniciar|reset|inicio|vuelve a empezar|comienza de nuevo|empieza de nuevo)\b/ },

  // Stop.
  { cmd: "STOP", test: /\b(detente|para|alto|frena|stop)\b/ },

  // Jump — discrete hop, always 1 block.
  { cmd: "JUMP", test: /\b(salta|saltar|salto|brinca|brincar|brinco)\b/ },

  // Lateral walking — kid-game semantics: pressing left/right walks ROBI
  // sideways (rotate + translate). Matches bare "izquierda" / "derecha" and
  // any directional walking phrase. A post-check below rejects cases where
  // the text also contains "gira" / "voltea" — those are turn phrases
  // (no longer a command) and shouldn't fall through to walk.
  { cmd: "WALK_LEFT", test: /\b(camina a la izquierda|ve a la izquierda|hacia la izquierda|izquierda)\b/, withSteps: true },
  { cmd: "WALK_RIGHT", test: /\b(camina a la derecha|ve a la derecha|hacia la derecha|derecha)\b/, withSteps: true },

  // Non-movement content actions.
  { cmd: "TELL_JOKE",    test: /\b(chiste|chistes|contame un chiste|cuenta un chiste|hazme reir|gracioso|graciosa)\b/ },
  { cmd: "TELL_RIDDLE",  test: /\b(adivinanza|adivinanzas|acertijo|acertijos|dame una adivinanza)\b/ },
  { cmd: "TELL_FACT",    test: /\b(dato|dato curioso|sabias que|curiosidad|cuento algo)\b/ },
  { cmd: "SAY_GOODBYE",  test: /\b(chau|adios|hasta luego|nos vemos|hasta pronto|bye)\b/ },
];

/**
 * Parse a free-text transcript into a typed command.
 * Returns UNKNOWN if nothing matches — caller may consult an LLM fallback.
 */
export function parseCommand(
  raw: string,
  options: { defaultSteps?: number } = {}
): RobiCommand {
  const text = normalize(raw);
  if (!text) return { type: "UNKNOWN", raw };

  // Pre-check: questions go to ANSWER_QUESTION with the full normalized
  // text as the payload. Done before the pattern loop so it isn't
  // shadowed by e.g. TELL_FACT's "sabias que" regex.
  if (isQuestionIntent(raw, text)) {
    return { type: "ANSWER_QUESTION", question: text };
  }

  // TURN verbs ("gira" / "voltea") used to mean in-place rotation. The
  // commands were removed — now they fall through to WALK_LEFT/RIGHT
  // because the patterns match the bare noun "izquierda" / "derecha"
  // inside "gira a la izquierda". Detect that case and force UNKNOWN.
  const hasTurnVerb = /\b(gira|voltea)\b/.test(text);

  for (const pattern of PATTERNS) {
    if (pattern.test.test(text)) {
      if (hasTurnVerb && (pattern.cmd === "WALK_LEFT" || pattern.cmd === "WALK_RIGHT")) {
        return { type: "UNKNOWN", raw };
      }
      if (
        pattern.withSteps ||
        pattern.cmd === "WALK_LEFT" ||
        pattern.cmd === "WALK_RIGHT"
      ) {
        const steps = extractSteps(
          text,
          options.defaultSteps ?? FALLBACK_CONFIG.defaultSteps,
        );
        switch (pattern.cmd) {
          case "WALK_LEFT":
            return { type: "WALK_LEFT", steps };
          case "WALK_RIGHT":
            return { type: "WALK_RIGHT", steps };
        }
      }
      return { type: pattern.cmd } as RobiCommand;
    }
  }

  return { type: "UNKNOWN", raw };
}
