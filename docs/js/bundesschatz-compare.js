import {
  BUNDESSCHATZ_KEST,
  SPAREINLAGE_KEST,
  calculateComparison,
  ceilPercentToHundredth,
  chooseValueDate,
  formatIsoDate,
  normalizeProducts,
  productsForValueDate
} from "./bundesschatz-utils.js";

const API_URL = "https://www.bundesschatz.at/customer-backend/api/public-products";

const state = {
  products: [],
  valueDate: null
};

const elements = {
  status: document.querySelector("[data-live-status]"),
  form: document.querySelector("[data-comparison-form]"),
  select: document.querySelector("[data-product-select]"),
  retry: document.querySelector("[data-retry]"),
  resultNodes: [...document.querySelectorAll("[data-comparison-result]")],
  valueDate: document.querySelector("[data-value-date]"),
  bsTerm: document.querySelector("[data-bs-term]"),
  bsRate: document.querySelector("[data-bs-rate]"),
  bankRate: document.querySelector("[data-bank-rate]"),
  maturity: document.querySelector("[data-maturity]"),
  netReturn: document.querySelector("[data-net-return]"),
  exactBankRate: document.querySelector("[data-exact-bank-rate]"),
  productKind: document.querySelector("[data-product-kind]")
};

const percentFormatter = new Intl.NumberFormat("de-AT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const exactPercentFormatter = new Intl.NumberFormat("de-AT", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4
});

function setStatus(type, message) {
  elements.status.className = `live-status live-status--${type}`;
  elements.status.textContent = message;
}

function productOptionLabel(product) {
  const suffix = product.green ? " · grün" : "";
  return `${product.label}${suffix} · ${percentFormatter.format(product.interestRate)} % p.a.`;
}

function populateProducts(products) {
  elements.select.innerHTML = products
    .map((product, index) => `<option value="${index}">${productOptionLabel(product)}</option>`)
    .join("");
  elements.select.disabled = false;
}

function renderComparison(product) {
  const comparison = calculateComparison(product);
  elements.valueDate.textContent = formatIsoDate(product.valueDate);
  elements.bsTerm.textContent = product.label;
  elements.bsRate.textContent = `${percentFormatter.format(product.interestRate)} % p.a.`;
  elements.maturity.textContent = formatIsoDate(comparison.maturityDate);
  elements.netReturn.textContent = `${percentFormatter.format(comparison.bundesschatz.netReturn * 100)} %`;
  elements.productKind.textContent = product.green ? "Grüner Bundesschatz" : "Bundesschatz";

  if (comparison.bankRate === null) {
    elements.bankRate.textContent = "nicht vergleichbar";
    elements.exactBankRate.textContent = "Bei einer Laufzeit unter 14 Tagen ist eine gewöhnliche Spareinlage nach der hier verwendeten gesetzlichen Vergleichslogik nicht verzinst.";
  } else {
    const displayRate = ceilPercentToHundredth(comparison.bankRate);
    elements.bankRate.textContent = `${percentFormatter.format(displayRate)} % p.a.`;
    elements.exactBankRate.textContent = `${exactPercentFormatter.format(comparison.bankRate * 100)} % p.a.`;
  }

  elements.resultNodes.forEach((node) => { node.hidden = false; });
}

function renderSelected() {
  const index = Number(elements.select.value);
  const product = state.products[index];
  if (!product) return;

  try {
    renderComparison(product);
  } catch (error) {
    console.error(error);
    setStatus("error", `Berechnung nicht möglich: ${error.message}`);
    elements.resultNodes.forEach((node) => { node.hidden = true; });
  }
}

async function loadProducts() {
  elements.select.disabled = true;
  elements.retry.hidden = true;
  elements.resultNodes.forEach((node) => { node.hidden = true; });
  setStatus("loading", "Aktuelle Bundesschatz-Konditionen werden geladen …");

  try {
    const response = await fetch(API_URL, {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    const normalized = normalizeProducts(payload);
    const valueDate = chooseValueDate(normalized);
    const products = productsForValueDate(normalized, valueDate);

    if (!products.length) {
      throw new Error("Für den aktuellen Valutatag wurden keine Angebote geliefert.");
    }

    state.valueDate = valueDate;
    state.products = products;
    populateProducts(products);
    setStatus(
      "success",
      `${products.length} aktuelle${products.length === 1 ? "s" : ""} Angebot${products.length === 1 ? "" : "e"} für Geldeingang am ${formatIsoDate(valueDate)} direkt von Bundesschatz geladen.`
    );
    renderSelected();
  } catch (error) {
    console.error(error);
    setStatus(
      "error",
      "Die aktuellen Bundesschatz-Konditionen konnten nicht direkt geladen werden. Es werden keine veralteten Ersatzwerte verwendet."
    );
    elements.select.innerHTML = '<option value="">Keine Live-Daten verfügbar</option>';
    elements.select.disabled = true;
    elements.retry.hidden = false;
  }
}

elements.form?.addEventListener("submit", (event) => event.preventDefault());
elements.select?.addEventListener("change", renderSelected);
elements.retry?.addEventListener("click", loadProducts);

loadProducts();
