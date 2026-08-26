(function initRobiFactCards() {
  "use strict";

  const facts = [
    ...(globalThis.ROBI_ALPHABET ?? []),
    ...(globalThis.ROBI_FACTS ?? [])
  ];
  const cardsElement = document.querySelector("#cards");
  const filtersElement = document.querySelector("#filters");
  const template = document.querySelector("#fact-card-template");
  const resultCount = document.querySelector("#result-count");
  const totalCount = document.querySelector("#total-count");
  const printButton = document.querySelector("#print-button");

  const CARDS_PER_SHEET = 9;
  const categoryOrder = ["Todas", "Abecedario", "Programación", "Historia", "Ingeniería", "Hardware", "Redes", "Datos", "IA", "Ciencia"];
  let selectedCategory = "Todas";

  const slugify = (value) => value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  function renderFilters() {
    const available = new Set(facts.map(({ category }) => category));

    for (const category of categoryOrder.filter((item) => item === "Todas" || available.has(item))) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filter-button";
      button.textContent = category;
      button.dataset.category = category;
      button.setAttribute("aria-pressed", String(category === selectedCategory));
      button.addEventListener("click", () => {
        selectedCategory = category;
        renderCards();
        updateFilterState();
      });
      filtersElement.append(button);
    }
  }

  function updateFilterState() {
    for (const button of filtersElement.querySelectorAll(".filter-button")) {
      button.setAttribute("aria-pressed", String(button.dataset.category === selectedCategory));
    }
  }

  function createCard(item) {
    const card = template.content.firstElementChild.cloneNode(true);
    const illustration = card.querySelector(".card-illustration");
    const isAlphabetCard = item.kind === "alphabet";

    card.classList.add(`category-${slugify(item.category)}`);
    card.classList.toggle("fact-card--alphabet", isAlphabetCard);
    card.dataset.category = item.category;
    card.querySelector(".fact-card__number").textContent = isAlphabetCard ? item.id : `N.º ${String(item.id).padStart(2, "0")}`;
    card.querySelector(".fact-card__category").textContent = item.category.toUpperCase();
    card.querySelector(".fact-card__year").textContent = isAlphabetCard ? item.letter : item.year;
    card.querySelector(".alphabet-letter").textContent = isAlphabetCard ? item.letter : "";
    card.querySelector(".fact-card__label").textContent = isAlphabetCard ? "QUIERE DECIR" : "DATO";
    card.querySelector(".fact-card__title").textContent = isAlphabetCard ? item.word : item.title;
    card.querySelector(".fact-card__fact").textContent = isAlphabetCard ? item.meaning : item.fact;
    card.querySelector(".fact-card__brand").textContent = isAlphabetCard ? "ROBI ABC" : "ROBI SABE";

    illustration.src = item.imageUrl;
    illustration.alt = isAlphabetCard
      ? `ROBI representa la palabra ${item.word}`
      : `ROBI ilustra: ${item.title}`;

    const source = card.querySelector(".fact-card__source");
    if (isAlphabetCard) {
      source.remove();
    } else {
      source.href = item.sourceUrl;
      source.setAttribute("aria-label", `Fuente: ${item.source}`);
      source.querySelector(".source-label").textContent = item.source;
    }

    return card;
  }

  function renderCards() {
    cardsElement.replaceChildren();
    const visibleFacts = selectedCategory === "Todas"
      ? facts
      : facts.filter(({ category }) => category === selectedCategory);
    const sheetCount = Math.ceil(visibleFacts.length / CARDS_PER_SHEET);
    const fragment = document.createDocumentFragment();

    for (let sheetIndex = 0; sheetIndex < sheetCount; sheetIndex += 1) {
      const start = sheetIndex * CARDS_PER_SHEET;
      const sheetItems = visibleFacts.slice(start, start + CARDS_PER_SHEET);
      const wrapper = document.createElement("div");
      const label = document.createElement("p");
      const sheet = document.createElement("section");
      const grid = document.createElement("div");

      wrapper.className = "sheet-wrapper";
      label.className = "sheet-label";
      label.textContent = `HOJA ${sheetIndex + 1} / ${sheetCount} · ${sheetItems.length} TARJETAS`;
      sheet.className = "print-sheet";
      sheet.setAttribute("aria-label", `Hoja ${sheetIndex + 1} de ${sheetCount}`);
      grid.className = "sheet-grid";
      grid.setAttribute("role", "list");

      for (const item of sheetItems) {
        grid.append(createCard(item));
      }

      sheet.append(grid);
      wrapper.append(label, sheet);
      fragment.append(wrapper);
    }

    cardsElement.append(fragment);
    const categoryText = selectedCategory === "Todas" ? "" : ` de ${selectedCategory}`;
    resultCount.textContent = `${visibleFacts.length} láminas${categoryText} · ${sheetCount} hojas A4`;
  }

  totalCount.textContent = facts.length;
  printButton.addEventListener("click", () => window.print());
  renderFilters();
  renderCards();
})();
