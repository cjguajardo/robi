import { describe, expect, it } from "vitest";
import { parseCommand } from "./parser";

describe("parser", () => {
  it("routes bare 'izquierda' / 'derecha' to lateral walk", () => {
    // The dpad arrows and the bare noun mean "walk sideways".
    expect(parseCommand("izquierda")).toEqual({ type: "WALK_LEFT", steps: 5 });
    expect(parseCommand("derecha")).toEqual({ type: "WALK_RIGHT", steps: 5 });
    expect(parseCommand("camina a la izquierda")).toEqual({ type: "WALK_LEFT", steps: 5 });
    expect(parseCommand("ve a la derecha tres pasos")).toEqual({ type: "WALK_RIGHT", steps: 3 });
    expect(parseCommand("ve a la derecha diez pasos")).toEqual({ type: "WALK_RIGHT", steps: 10 });
  });

  it("returns UNKNOWN for 'gira' / 'voltea' (turns removed)", () => {
    // ROBI no longer rotates in place — only lateral walk and jump.
    expect(parseCommand("gira a la izquierda")).toEqual({
      type: "UNKNOWN",
      raw: "gira a la izquierda",
    });
    expect(parseCommand("voltea a la derecha")).toEqual({
      type: "UNKNOWN",
      raw: "voltea a la derecha",
    });
  });

  it("routes 'salta' / 'saltar' / 'brinca' to JUMP", () => {
    expect(parseCommand("salta")).toEqual({ type: "JUMP" });
    expect(parseCommand("saltar")).toEqual({ type: "JUMP" });
    expect(parseCommand("brinca")).toEqual({ type: "JUMP" });
  });

  it("parses greetings", () => {
    expect(parseCommand("hola robi")).toEqual({ type: "GREET" });
    expect(parseCommand("buenos dias")).toEqual({ type: "GREET" });
  });

  it("parses stop and reset and dance and celebrate", () => {
    expect(parseCommand("detente")).toEqual({ type: "STOP" });
    expect(parseCommand("reiniciar")).toEqual({ type: "RESET" });
    expect(parseCommand("baila")).toEqual({ type: "DANCE" });
    expect(parseCommand("lo logramos")).toEqual({ type: "CELEBRATE" });
  });

  it("returns UNKNOWN for forward/backward voice commands (MOVE_* removed)", () => {
    // ROBI no longer has forward/backward — only lateral walk and jump.
    expect(parseCommand("avanza tres pasos")).toEqual({
      type: "UNKNOWN",
      raw: "avanza tres pasos",
    });
    expect(parseCommand("robi retrocede dos pasos")).toEqual({
      type: "UNKNOWN",
      raw: "robi retrocede dos pasos",
    });
  });

  it("returns UNKNOWN for nonsense", () => {
    expect(parseCommand("vuela a marte")).toEqual({
      type: "UNKNOWN",
      raw: "vuela a marte",
    });
  });

  it("celebration beats greeting (more specific)", () => {
    expect(parseCommand("hola robi, lo logramos")).toEqual({ type: "CELEBRATE" });
  });

  it("parses non-movement content actions", () => {
    expect(parseCommand("contame un chiste")).toEqual({ type: "TELL_JOKE" });
    expect(parseCommand("hazme reir")).toEqual({ type: "TELL_JOKE" });
    expect(parseCommand("dame una adivinanza")).toEqual({ type: "TELL_RIDDLE" });
    expect(parseCommand("dato curioso")).toEqual({ type: "TELL_FACT" });
    expect(parseCommand("sabías que...")).toEqual({ type: "TELL_FACT" });
    expect(parseCommand("chau")).toEqual({ type: "SAY_GOODBYE" });
    expect(parseCommand("adiós")).toEqual({ type: "SAY_GOODBYE" });
    expect(parseCommand("nos vemos")).toEqual({ type: "SAY_GOODBYE" });
  });

  it("routes questions with question marks to ANSWER_QUESTION", () => {
    expect(parseCommand("¿qué es un robot?")).toEqual({
      type: "ANSWER_QUESTION",
      question: "que es un robot",
    });
    expect(parseCommand("¿por qué el cielo es azul?")).toEqual({
      type: "ANSWER_QUESTION",
      question: "por que el cielo es azul",
    });
    expect(parseCommand("como funciona internet?")).toEqual({
      type: "ANSWER_QUESTION",
      question: "como funciona internet",
    });
  });

  it("routes interrogative sentences without question marks when long enough", () => {
    expect(parseCommand("como funciona un robot")).toEqual({
      type: "ANSWER_QUESTION",
      question: "como funciona un robot",
    });
    expect(parseCommand("que son los programadores")).toEqual({
      type: "ANSWER_QUESTION",
      question: "que son los programadores",
    });
  });

  it("does not steal short GREET forms for the question pre-check", () => {
    // 2-word greetings must still go to GREET.
    expect(parseCommand("que tal")).toEqual({ type: "GREET" });
    expect(parseCommand("como estas")).toEqual({ type: "GREET" });
    expect(parseCommand("buenos dias")).toEqual({ type: "GREET" });
  });
});
