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

function getRasterDimensions(buffer) {
  const pngSignature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") === pngSignature) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = buffer[offset + 1];
      const blockLength = buffer.readUInt16BE(offset + 2);
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += blockLength + 2;
    }
  }

  throw new Error("Formato de imagen no compatible");
}

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
  const { width, height } = getRasterDimensions(png);
  assert.ok(width >= 732 && height >= 1020, `${card.id} debe conservar resolución suficiente para imprimir`);
  assert.ok(Math.abs(width / height - 63 / 88) < 0.005, `${card.id} debe respetar la proporción de la tarjeta`);
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
assert.match(css, /\.fact-card__frame\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s, "El contenido largo no debe ensanchar la columna interna de una carta");
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
  const raster = await readFile(fileUrl);
  const { width, height } = getRasterDimensions(raster);
  assert.ok(width >= 732 && height >= 1020, `${imageUrl} debe tener resolución suficiente para imprimir`);
  assert.ok(Math.abs(width / height - 63 / 88) < 0.005, `${imageUrl} debe respetar la proporción de la tarjeta`);
}

const printedBackSources = [...backPrintHtml.matchAll(/class="card-back__image" src="(\.\/images\/backs\/[^"]+)"/g)].map((match) => match[1]);
const preloadedBack = backPrintHtml.match(/<link rel="preload" as="image" href="(\.\/images\/backs\/[^"]+)">/)?.[1];
assert.equal((backPrintHtml.match(/class="fact-card card-back"/g) ?? []).length, 9, "La hoja de reversos debe contener nueve cartas");
assert.equal(printedBackSources.length, 9, "La hoja debe cargar nueve imágenes de reverso");
assert.equal(new Set(printedBackSources).size, 1, "Los nueve reversos deben usar el mismo diseño");
assert.ok(cardBacks.includes(printedBackSources[0]), "La hoja debe usar uno de los diseños de reverso aprobados");
assert.equal(preloadedBack, printedBackSources[0], "El preload debe coincidir con el reverso que se imprime");
assert.match(backPrintHtml, /window\.print\(\)/);
assert.match(backPrintHtml, /2,5 mm de sangrado por lado/, "La hoja de reversos debe explicar el sangrado de corte");
assert.match(css, /\.card-back__image\s*{/);
assert.match(css, /@media print[\s\S]*?\.back-print-page \.sheet-grid\s*{[^}]*grid-template-rows:\s*repeat\(3,\s*85mm\);/, "Los centros de los reversos deben conservar la grilla frontal");
assert.match(css, /@media print[\s\S]*?\.back-print-page \.card-back\s*{[^}]*width:\s*66mm;[^}]*height:\s*90mm;[^}]*top:\s*-2\.5mm;[^}]*left:\s*-2\.5mm;[^}]*border-radius:\s*0;/, "Cada reverso debe sumar 2,5 mm de sangrado por lado, conservar su centro y cubrir también las esquinas");
assert.match(css, /\.fact-card--illustration-rare/);
assert.match(css, /@media print[\s\S]*?\.fact-card--illustration-rare \.fact-card__frame\s*{[^}]*box-shadow:\s*none;/, "Las cartas Illustration Rare no deben invadir el espacio de corte al imprimir");
assert.match(css, /\.fact-card\s*{[^}]*color-scheme:\s*only light;/s, "Las cartas claras no deben heredar el esquema oscuro del sitio en Safari");
assert.match(css, /@media print[\s\S]*?\.fact-card:not\(\.fact-card--illustration-rare\) \.fact-card__content\s*{[^}]*background:\s*#f8f3e8 !important;/, "Safari debe imprimir el contenido de las cartas normales sobre papel claro");
assert.match(css, /@media print[\s\S]*?\.fact-card\s*{[^}]*-webkit-print-color-adjust:\s*exact;[^}]*print-color-adjust:\s*exact;/, "Cada carta debe preservar sus colores al imprimir");
assert.match(css, /@media print[\s\S]*?\.fact-card__header\s*{[^}]*position:\s*relative;[^}]*display:\s*flex;[^}]*justify-content:\s*center;/, "El encabezado impreso debe centrar la categoría sin empujar el año");
assert.match(css, /@media print[\s\S]*?\.fact-card__year\s*{[^}]*position:\s*absolute;[^}]*right:\s*2\.4mm;/, "El año debe quedar anclado al borde derecho de cada carta");
assert.match(css, /@media print[\s\S]*?\.fact-card--illustration-rare \.fact-card__frame\s*{[^}]*display:\s*block;[^}]*border:\s*0;/, "Las Illustration Rare deben conservar su marco full art al imprimir");
assert.match(css, /@media print[\s\S]*?\.fact-card--illustration-rare \.fact-card__visual\s*{[^}]*position:\s*absolute;[^}]*inset:\s*0;/, "La imagen Illustration Rare debe ocupar toda la carta impresa");
assert.match(css, /@media print[\s\S]*?\.fact-card--illustration-rare \.fact-card__header\s*{[^}]*background:\s*none !important;/, "Safari no debe rasterizar una franja opaca sobre la cabecera full art");
assert.match(css, /@media print[\s\S]*?\.fact-card--illustration-rare \.fact-card__content\s*{[^}]*position:\s*absolute;[^}]*background:\s*none !important;/, "Safari no debe convertir el overlay Illustration Rare en un bloque negro");
assert.match(css, /@media print[\s\S]*?\.fact-card--illustration-rare \.fact-card__footer\s*{[^}]*background:\s*none !important;/, "El arte debe continuar detrás del pie de las Illustration Rare");

console.log(`OK: ${facts.length + alphabet.length} láminas verificadas (${alphabet.length} del abecedario)`);
