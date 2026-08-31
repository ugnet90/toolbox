import {
  calculateComparison,
  ceilPercentToHundredth,
  chooseValueDate,
  formatIsoDate,
  formatTerm,
  normalizeProducts,
  productsForValueDate,
  viennaDateTimeParts
} from "./bundesschatz-utils.js";

const API_URL = "https://toolbox-bundesschatz-proxy.daniel-koechler.workers.dev/bundesschatz";

const state = {
  products: [],
  valueDate: null
};

const elements = {
  status: document.querySelector("[data-live-status]"),
  form: document.querySelector("[data-comparison-form]"),
  select: document.querySelector("[data-product-select]"),
  retry: document.querySelector("[data-retry]"),
  manualForm: document.querySelector("[data-manual-form]"),
  manualError: document.querySelector("[data-manual-error]"),
  manualValueDate: document.querySelector("#manualValueDate"),
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

function renderComparison(product, manual = false) {
  const comparison = calculateComparison(product);
  elements.valueDate.textContent = formatIsoDate(product.valueDate);
  elements.bsTerm.textContent = product.label;
  elements.bsRate.textContent = `${percentFormatter.format(product.interestRate)} % p.a.`;
  elements.maturity.textContent = formatIsoDate(comparison.maturityDate);
  elements.netReturn.textContent = `${percentFormatter.format(comparison.bundesschatz.netReturn * 100)} %`;
  elements.productKind.textContent = manual ? "Bundesschatz · manuell" : (product.green ? "Grüner Bundesschatz" : "Bundesschatz");

  if (comparison.bankRate === null) {
    elements.bankRate.textContent = "nicht vergleichbar";
    elements.exactBankRate.textContent = "Bei einer Laufzeit unter 14 Tagen ist eine gewöhnliche Spareinlage nach der hier verwendeten Vergleichslogik nicht verzinst.";
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
    renderComparison(product, false);
  } catch (error) {
    console.error(error);
    setStatus("error", `Berechnung nicht möglich: ${error.message}`);
    elements.resultNodes.forEach((node) => { node.hidden = true; });
  }
}

function parsePercent(value) {
  const normalized = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  return Number(normalized);
}

function showManualFallback() {
  elements.manualForm.hidden = false;
  if (elements.manualValueDate && !elements.manualValueDate.value) {
    elements.manualValueDate.value = viennaDateTimeParts().date;
  }
}

async function loadProducts() {
  elements.select.disabled = true;
  elements.retry.hidden = true;
  elements.manualForm.hidden = true;
  elements.manualError.hidden = true;
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
      `${products.length} aktuelle${products.length === 1 ? "s" : ""} Angebot${products.length === 1 ? "" : "e"} für Geldeingang am ${formatIsoDate(valueDate)} von Bundesschatz geladen.`
    );
    renderSelected();
  } catch (error) {
    console.error(error);
    setStatus(
      "error",
      "Die aktuellen Bundesschatz-Konditionen konnten nicht geladen werden. Du kannst die Konditionen darunter manuell eingeben."
    );
    elements.select.innerHTML = '<option value="">Keine Live-Daten verfügbar</option>';
    elements.select.disabled = true;
    elements.retry.hidden = false;
    showManualFallback();
  }
}

elements.form?.addEventListener("submit", (event) => event.preventDefault());
elements.select?.addEventListener("change", renderSelected);
elements.retry?.addEventListener("click", loadProducts);

elements.manualForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(elements.manualForm);

  try {
    const periodValue = Number(data.get("termValue"));
    const periodInterval = String(data.get("termUnit"));
    const interestRate = parsePercent(data.get("interestRate"));
    const valueDate = String(data.get("valueDate") ?? "");

    if (!Number.isInteger(periodValue) || periodValue <= 0) throw new Error("Die Laufzeit muss eine positive ganze Zahl sein.");
    if (!["D", "W", "M", "Y"].includes(periodInterval)) throw new Error("Ungültige Laufzeiteinheit.");
    if (!Number.isFinite(interestRate) || interestRate < 0) throw new Error("Bitte einen gültigen Zinssatz eingeben.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valueDate)) throw new Error("Bitte ein gültiges Valutadatum eingeben.");

    const product = {
      productKey: "manual",
      periodValue,
      periodInterval,
      interestRate,
      valueDate,
      green: false,
      label: formatTerm(periodValue, periodInterval)
    };

    elements.manualError.hidden = true;
    renderComparison(product, true);
  } catch (error) {
    elements.manualError.textContent = error.message || "Manuelle Berechnung nicht möglich.";
    elements.manualError.hidden = false;
    elements.resultNodes.forEach((node) => { node.hidden = true; });
  }
});

loadProducts();
