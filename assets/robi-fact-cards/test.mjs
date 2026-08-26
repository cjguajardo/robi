import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

await import("./facts.js");
await import("./alphabet.js");

const facts = globalThis.ROBI_FACTS;
const alphabet = globalThis.ROBI_ALPHABET;
const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
const backPrintHtml = await readFile(new URL("./print-backs.html", import.meta.url), "utf8");
const css = await readFile(new URL("./styles.css", import.meta.url), "utf8");
const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
const cardBacks = [
  "./images/backs/robi-card-back-circuit-core.png",
  "./images/backs/robi-card-back-digital-portal.png"
];
const rareCards = facts.filter(({ kind }) => kind === "illustration-rare");

assert.ok(Array.isArray(facts), "ROBI_FACTS debe ser un arreglo");
assert.equal(facts.length, 45, "La colección debe incluir 40 curiosidades y 5 cartas Illustration Rare");
assert.equal(new Set(facts.map(({ id }) => id)).size, facts.length, "Cada lámina debe tener un id único");

for (const fact of facts) {
  const isRare = fact.kind === "illustration-rare";
  for (const field of ["year", "category", "title", "fact", "imageUrl"]) {
    assert.ok(fact[field], `La lámina ${fact.id} debe definir ${field}`);
  }

  if (isRare) {
    assert.equal(fact.rarity, "Illustration Rare");
    assert.match(fact.imageUrl, /^\.\/images\/rare\/.+\.png$/, `La lámina ${fact.id} debe usar arte Illustration Rare`);
  } else {
    for (const field of ["source", "sourceUrl"]) {
      assert.ok(fact[field], `La lámina ${fact.id} debe definir ${field}`);
    }
    assert.match(fact.sourceUrl, /^https:\/\//, `La fuente de la lámina ${fact.id} debe usar HTTPS`);
    assert.match(fact.imageUrl, /^\.\/images\/facts\/.+\.png$/, `La lámina ${fact.id} debe usar una imagen individual`);
  }

  assert.ok(fact.title.split(/\s+/).length <= 4, `El título de la lámina ${fact.id} debe tener hasta 4 palabras`);
  assert.ok(fact.fact.split(/\s+/).length <= 11, `El texto de la lámina ${fact.id} debe tener hasta 11 palabras`);
  assert.ok(fact.fact.length <= 75, `El texto de la lámina ${fact.id} debe ser corto`);
  await access(new URL(fact.imageUrl, import.meta.url));
}

assert.equal(rareCards.length, 5, "Deben existir cinco cartas Illustration Rare");
assert.deepEqual(rareCards.map(({ title }) => title), [
  "Hard Debugging",
  "Coding Illumination",
  "Deploy to Production",
  "Fancy Testing",
  "Hands to Work"
]);

for (const card of rareCards) {
  const png = await readFile(new URL(card.imageUrl, import.meta.url));
  assert.equal(png.readUInt32BE(16), 732, `${card.id} debe tener 732 px de ancho`);
  assert.equal(png.readUInt32BE(20), 1020, `${card.id} debe tener 1020 px de alto`);
}

const expectedLetters = [..."ABCDEFGHIJKLMNÑOPQRSTUVWXYZ"];
assert.ok(Array.isArray(alphabet), "ROBI_ALPHABET debe ser un arreglo");
assert.equal(alphabet.length, 27, "El abecedario español debe tener 27 láminas");
assert.deepEqual(alphabet.map(({ letter }) => letter), expectedLetters, "Debe existir una lámina por letra, incluida la Ñ");

for (const card of alphabet) {
  for (const field of ["id", "letter", "word", "meaning", "imageUrl"]) {
    assert.ok(card[field], `La lámina ${card.letter} debe definir ${field}`);
  }

  assert.equal(card.category, "Abecedario");
  assert.equal(card.word[0].normalize("NFD")[0].toUpperCase(), card.letter.normalize("NFD")[0], `${card.word} debe comenzar con ${card.letter}`);
  assert.ok(card.meaning.split(/\s+/).length <= 10, `El significado de ${card.word} debe tener hasta 10 palabras`);
  assert.ok(card.meaning.length <= 65, `El significado de ${card.word} debe ser breve para lectores iniciales`);
  assert.match(card.imageUrl, /^\.\/images\/alphabet\/.+\.png$/, `La lámina ${card.letter} debe usar una imagen individual`);
  await access(new URL(card.imageUrl, import.meta.url));
}

assert.equal(facts.length + alphabet.length, 72, "La colección completa debe tener 72 láminas");
assert.equal(new Set([...facts, ...alphabet].map(({ imageUrl }) => imageUrl)).size, 72, "Cada lámina debe tener una imagen diferente");

assert.match(html, /card-illustration/);
assert.match(html, /href="\.\/print-backs\.html"/);
assert.doesNotMatch(html, /sticker-sprite|sticker-viewport/);
assert.match(html, /alphabet\.js/);
assert.match(html, /aria-live="polite"/);
assert.match(html, />72<\/strong>/);
assert.match(app, /CARDS_PER_SHEET\s*=\s*9/);
assert.match(app, /isIllustrationRare/);
assert.match(app, /print-sheet/);
assert.doesNotMatch(app, /sticker-sprite|spriteIndex/);
assert.match(app, /if \(isAlphabetCard \|\| isIllustrationRare\) \{\s*source\.remove\(\)/, "Las tarjetas ABC e Illustration Rare no deben mostrar una fuente");
assert.doesNotMatch(`${app}\n${html}\n${alphabet.map(JSON.stringify).join("\n")}`, /6[–-]7 años/);
assert.match(css, /\.print-sheet/);
assert.match(css, /grid-template-columns:\s*repeat\(3/);
assert.match(css, /@media print/);
assert.match(css, /@page/);
assert.match(css, /@page\s*{[^}]*size:\s*A4 portrait;[^}]*margin:\s*5mm;/s, "La impresión debe reservar un margen seguro");
assert.match(css, /\.sheet-wrapper\s*\+\s*\.sheet-wrapper\s*{[^}]*break-before:\s*page;/s, "Cada hoja debe comenzar en una página nueva");
assert.match(css, /@media print[\s\S]*?\.sheet-wrapper\s*{[^}]*width:\s*200mm;[^}]*height:\s*286mm;/, "La hoja debe quedar dentro del área imprimible");
assert.match(css, /@media print[\s\S]*?\.sheet-grid\s*{[^}]*grid-template-columns:\s*repeat\(3,\s*61mm\);[^}]*width:\s*189mm;/, "La grilla no debe superar el ancho imprimible");
assert.match(css, /@media print[\s\S]*?\.print-sheet\s*{[^}]*padding:\s*10mm 5mm 5mm;/, "La impresión debe duplicar el margen superior interno");
assert.doesNotMatch(css, /@media print[\s\S]*?\.sheet-wrapper\s*{[^}]*break-after:\s*page;/, "Los saltos posteriores pueden crear páginas vacías en Safari");

for (const imageUrl of cardBacks) {
  const fileUrl = new URL(imageUrl, import.meta.url);
  await access(fileUrl);
  const png = await readFile(fileUrl);
  assert.equal(png.readUInt32BE(16), 732, `${imageUrl} debe tener el ancho de impresión acordado`);
  assert.equal(png.readUInt32BE(20), 1020, `${imageUrl} debe respetar la proporción de la tarjeta`);
}

assert.equal((backPrintHtml.match(/class="fact-card card-back"/g) ?? []).length, 9, "La hoja de reversos debe contener nueve cartas");
assert.equal((backPrintHtml.match(/src="\.\/images\/backs\/robi-card-back-circuit-core\.png"/g) ?? []).length, 9, "Los nueve reversos deben usar el diseño Circuit Core");
assert.doesNotMatch(backPrintHtml, /robi-card-back-digital-portal\.png/);
assert.match(backPrintHtml, /window\.print\(\)/);
assert.match(css, /\.card-back__image\s*{/);
assert.match(css, /\.fact-card--illustration-rare/);
assert.match(css, /@media print[\s\S]*?\.fact-card--illustration-rare \.fact-card__frame\s*{[^}]*box-shadow:\s*none;/, "Las cartas Illustration Rare no deben invadir el espacio de corte al imprimir");

console.log(`OK: ${facts.length + alphabet.length} láminas verificadas (${alphabet.length} del abecedario)`);
