import {
  effectiveIssueLoadPercent,
  simulateInsuranceFundComparison,
  createInsuranceFundCompareData,
  normalizeInsuranceFundCompareData
} from "./insurance-fund-compare-utils.js?v=0.7.0";

const TOOLBOX_VERSION = "0.7.0";

const form = document.querySelector("[data-ifc-form]");
const resultsHost = document.querySelector("[data-results]");
const errorHost = document.querySelector("[data-error]");
const importFile = document.querySelector("[data-import-file]");

const PRODUCT_PRESETS = {
  ergo_investment: {
    minimum: 30000,
    tax: 4,
    entryCost: 5,
    entryYears: 5,
    admin: 0.2,
    hint: "Mindest-Einmalprämie 30.000 €. Abschlusskosten 5 % der Nettoeinmalprämie, gleichmäßig über fünf Jahre; Verwaltung 0,2 % p.a. der Deckungsrückstellung. Risikokosten laut Vertrag."
  },
  ergo_life: {
    minimum: 5000,
    tax: 4,
    entryCost: "",
    entryYears: 5,
    admin: "",
    hint: "Mindest-Einmalprämie 5.000 €. Für den Vergleich 100 % Fondsveranlagung. Abschluss-, Verwaltungs- und Risikokosten bitte aus dem konkreten Versicherungsantrag übernehmen."
  },
  custom: {
    minimum: 0,
    tax: 4,
    entryCost: "",
    entryYears: 5,
    admin: "",
    hint: "Alle Kosten und die Mindestprämie individuell erfassen."
  }
};

function el(id) {
  return document.getElementById(id);
}

function parseGermanNumber(value) {
  let normalized = String(value ?? "").trim().replace(/[\s']/g, "");
  if (!normalized) return NaN;
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (comma >= 0) {
    normalized = normalized.replace(",", ".");
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }
  return Number(normalized);
}

function money(value) {
  return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function pct(value, digits = 2) {
  return `${new Intl.NumberFormat("de-AT", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value) || 0)} %`;
}

function formatAmountInput(input) {
  const value = parseGermanNumber(input.value);
  if (!Number.isFinite(value)) return;
  input.value = new Intl.NumberFormat("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function numericValue(id, { allowBlank = false } = {}) {
  const node = el(id);
  const raw = node?.value ?? "";
  if (allowBlank && String(raw).trim() === "") return null;
  const value = node?.type === "text" ? parseGermanNumber(raw) : Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${node?.labels?.[0]?.textContent?.trim() || id} ist ungültig.`);
  return value;
}

function collectInputs() {
  const product = el("insuranceProduct").value;
  const entryCost = numericValue("insuranceEntryCostPercent", { allowBlank: true });
  const adminCost = numericValue("insuranceAdminPercent", { allowBlank: true });
  if (entryCost === null) throw new Error("Bitte die Abschlusskosten der gewählten Versicherung eintragen.");
  if (adminCost === null) throw new Error("Bitte die jährlichen Verwaltungskosten der gewählten Versicherung eintragen.");

  return {
    product,
    fundName: el("fundName").value.trim(),
    fundIsin: el("fundIsin").value.trim().toUpperCase(),
    amount: numericValue("amount"),
    years: numericValue("years"),
    grossReturnPercent: numericValue("grossReturnPercent"),
    fundCostPercent: numericValue("fundCostPercent"),
    insuranceTaxPercent: numericValue("insuranceTaxPercent"),
    insuranceMinimumAmount: numericValue("insuranceMinimumAmount"),
    insuranceEntryCostPercent: entryCost,
    insuranceEntryCostYears: numericValue("insuranceEntryCostYears"),
    insuranceAdminPercent: adminCost,
    insuranceRiskAnnual: numericValue("insuranceRiskAnnual"),
    age50Plus: el("age50Plus").checked,
    personalTaxPercent: numericValue("personalTaxPercent"),
    issueLoadPercent: numericValue("issueLoadPercent"),
    issueLoadDiscountPercent: numericValue("issueLoadDiscountPercent"),
    depotFeePercent: numericValue("depotFeePercent"),
    depotFeeAnnual: numericValue("depotFeeAnnual"),
    capitalGainsTaxPercent: numericValue("capitalGainsTaxPercent"),
    directTaxMode: el("directTaxMode").value,
    annualTaxableYieldPercent: numericValue("annualTaxableYieldPercent")
  };
}

function setError(message = "") {
  if (!message) {
    errorHost.hidden = true;
    errorHost.textContent = "";
    return;
  }
  errorHost.hidden = false;
  errorHost.textContent = message;
}

function updateProductPreset({ preserveManual = false } = {}) {
  const product = el("insuranceProduct").value;
  const preset = PRODUCT_PRESETS[product];
  if (!preset) return;

  if (!preserveManual) {
    el("insuranceMinimumAmount").value = preset.minimum;
    el("insuranceTaxPercent").value = preset.tax;
    el("insuranceEntryCostPercent").value = preset.entryCost;
    el("insuranceEntryCostYears").value = preset.entryYears;
    el("insuranceAdminPercent").value = preset.admin;
    el("insuranceRiskAnnual").value = "0,00";
  }
  document.querySelector("[data-product-hint]").textContent = preset.hint;
  updateShortTermWarning();
}

function updateShortTermWarning() {
  const years = Number(el("years").value);
  const minYears = el("age50Plus").checked ? 10 : 15;
  const warning = document.querySelector("[data-short-term-warning]");
  const text = document.querySelector("[data-short-term-text]");
  const show = Number.isFinite(years) && years < minYears && Number(el("insuranceTaxPercent").value) < 11;
  warning.hidden = !show;
  if (show) {
    text.textContent = `Bei einer Auszahlung nach ${years} Jahr(en) liegt die Modelllaufzeit unter ${minYears} Jahren. Der Rechner berücksichtigt deshalb 7 % zusätzliche Versicherungssteuer; eine mögliche Differenz-ESt wird mit dem unten eingegebenen persönlichen Steuersatz modelliert.`;
  }
}

function updateDirectTaxFields() {
  document.querySelector("[data-annual-taxable-yield-field]").hidden = el("directTaxMode").value !== "annual_proxy";
}

function updateEffectiveIssueLoad() {
  try {
    const effective = effectiveIssueLoadPercent(Number(el("issueLoadPercent").value), Number(el("issueLoadDiscountPercent").value));
    document.querySelector("[data-effective-issue-load]").textContent = pct(effective);
  } catch {
    document.querySelector("[data-effective-issue-load]").textContent = "–";
  }
}

function updateOekbLink() {
  const isin = el("fundIsin").value.trim().toUpperCase();
  const link = document.querySelector("[data-oekb-link]");
  link.href = /^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)
    ? `https://my.oekb.at/kapitalmarkt-services/kms-output/fonds-info/sd/af/f?isin=${encodeURIComponent(isin)}`
    : "https://my.oekb.at/kapitalmarkt-services/kms-output/fonds-info/sd/af/f";
}

function rowsToDl(rows) {
  return rows.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join("");
}

function renderChart(history) {
  const host = document.querySelector("[data-chart]");
  const points = Array.isArray(history) ? history : [];
  if (!points.length) {
    host.innerHTML = "";
    return;
  }

  const width = 900;
  const height = 320;
  const pad = { left: 72, right: 24, top: 20, bottom: 42 };
  const values = points.flatMap((p) => [p.insuranceNetValue, p.directNetValue, 0]);
  const maxValue = Math.max(...values) || 1;
  const minValue = Math.min(...values, 0);
  const x = (year) => pad.left + ((year - 1) / Math.max(1, points.length - 1)) * (width - pad.left - pad.right);
  const y = (value) => pad.top + (maxValue - value) / Math.max(1, maxValue - minValue) * (height - pad.top - pad.bottom);
  const pathFor = (key) => points.map((p, index) => `${index ? "L" : "M"}${x(p.year).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");

  const grid = [];
  for (let i = 0; i <= 4; i += 1) {
    const value = minValue + ((maxValue - minValue) * i / 4);
    const yy = y(value);
    grid.push(`<line x1="${pad.left}" y1="${yy}" x2="${width - pad.right}" y2="${yy}" class="ifc-chart-grid"/>`);
    grid.push(`<text x="${pad.left - 10}" y="${yy + 4}" text-anchor="end" class="ifc-chart-label">${Math.round(value).toLocaleString("de-AT")} €</text>`);
  }

  const yearLabels = points.filter((_, index) => index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 6) === 0)
    .map((p) => `<text x="${x(p.year)}" y="${height - 12}" text-anchor="middle" class="ifc-chart-label">${p.year}</text>`).join("");

  host.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Entwicklung der Nettoauszahlungswerte">
      <style>
        .ifc-chart-grid{stroke:var(--border);stroke-width:1}.ifc-chart-label{fill:var(--text-muted);font:12px system-ui,sans-serif}.ifc-chart-line-a{fill:none;stroke:var(--accent);stroke-width:3}.ifc-chart-line-b{fill:none;stroke:color-mix(in srgb,var(--accent) 45%,#9b7e25);stroke-width:3}
      </style>
      ${grid.join("")}
      <path d="${pathFor("insuranceNetValue")}" class="ifc-chart-line-a"/>
      <path d="${pathFor("directNetValue")}" class="ifc-chart-line-b"/>
      ${yearLabels}
      <text x="${(pad.left + width - pad.right) / 2}" y="${height - 1}" text-anchor="middle" class="ifc-chart-label">Jahr</text>
    </svg>`;
}

function renderResult(result) {
  document.querySelector("[data-insurance-end]").textContent = money(result.insurance.endValue);
  document.querySelector("[data-insurance-return]").textContent = `Netto-Effektivrendite ${pct(result.insurance.effectiveReturn * 100) } p.a.`;
  document.querySelector("[data-direct-end]").textContent = money(result.direct.endValue);
  document.querySelector("[data-direct-return]").textContent = `Netto-Effektivrendite ${pct(result.direct.effectiveReturn * 100)} p.a.`;

  const diff = result.comparison.difference;
  const winnerText = result.comparison.winner === "insurance"
    ? "Vorteil Fondsversicherung"
    : result.comparison.winner === "direct"
      ? "Vorteil Fondsdepot"
      : "Gleichstand";
  document.querySelector("[data-difference-label]").textContent = winnerText;
  document.querySelector("[data-difference]").textContent = result.comparison.winner === "equal" ? money(0) : `${diff >= 0 ? "+" : ""}${money(diff)}`;
  document.querySelector("[data-break-even]").textContent = result.comparison.breakEvenYear
    ? `Fondsversicherung erstmals ab Jahr ${result.comparison.breakEvenYear} vorne`
    : "Kein Break-even zugunsten der Fondsversicherung innerhalb der Laufzeit";

  document.querySelector("[data-insurance-breakdown]").innerHTML = rowsToDl([
    ["Kundenaufwand", money(result.inputs.amount)],
    ["Nettoeinmalprämie nach VSt", money(result.insurance.initialNetPremium)],
    ["Versicherungssteuer bei Einzahlung", money(result.insurance.initialInsuranceTax)],
    ["Abschlusskosten gesamt", money(result.insurance.entryCostCharged)],
    ["Verwaltungskosten gesamt", money(result.insurance.adminCosts)],
    ["Risikokosten gesamt", money(result.insurance.riskCosts)],
    ["Fondskosten gesamt (Modell)", money(result.insurance.fundCosts)],
    ["Zusätzliche VSt bei frühem Ausstieg", money(result.insurance.additionalInsuranceTax)],
    ["Differenz-ESt bei frühem Ausstieg", money(result.insurance.incomeTax)],
    ["Nettoendwert", money(result.insurance.endValue)]
  ]);

  document.querySelector("[data-direct-breakdown]").innerHTML = rowsToDl([
    ["Kundenaufwand", money(result.inputs.amount)],
    ["Tatsächlich investiert", money(result.direct.initialInvestment)],
    ["Ausgabeaufschlag", money(result.direct.issueLoadCost)],
    ["Depotkosten gesamt", money(result.direct.depotCosts)],
    ["Fondskosten gesamt (Modell)", money(result.direct.fundCosts)],
    ["Unterjährige KESt (Modell)", money(result.direct.annualTaxes)],
    ["KESt bei Verkauf", money(result.direct.saleTax)],
    ["Steuern gesamt", money(result.direct.totalTaxes)],
    ["Nettoendwert", money(result.direct.endValue)]
  ]);

  renderChart(result.history);
  resultsHost.hidden = false;
  resultsHost.scrollIntoView({ behavior: "smooth", block: "start" });
}

function calculate() {
  setError();
  try {
    const inputs = collectInputs();
    const result = simulateInsuranceFundComparison(inputs);
    renderResult(result);
    return { inputs, result };
  } catch (error) {
    resultsHost.hidden = true;
    setError(error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function saveJsonFile(data, suggestedName) {
  const text = JSON.stringify(data, null, 2);
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: "JSON-Datei", accept: { "application/json": [".json"] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function applyInputs(inputs) {
  const setters = {
    amount: (v) => { el("amount").value = new Intl.NumberFormat("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v)); },
    insuranceRiskAnnual: (v) => { el("insuranceRiskAnnual").value = new Intl.NumberFormat("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v)); },
    depotFeeAnnual: (v) => { el("depotFeeAnnual").value = new Intl.NumberFormat("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v)); },
    age50Plus: (v) => { el("age50Plus").checked = Boolean(v); }
  };
  Object.entries(inputs || {}).forEach(([key, value]) => {
    if (setters[key]) return setters[key](value);
    const node = el(key === "product" ? "insuranceProduct" : key);
    if (node && value !== undefined && value !== null) node.value = String(value);
  });
  updateProductPreset({ preserveManual: true });
  updateDirectTaxFields();
  updateEffectiveIssueLoad();
  updateShortTermWarning();
  updateOekbLink();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculate();
});

el("insuranceProduct").addEventListener("change", () => updateProductPreset());
el("directTaxMode").addEventListener("change", updateDirectTaxFields);
el("age50Plus").addEventListener("change", updateShortTermWarning);
el("years").addEventListener("input", updateShortTermWarning);
el("insuranceTaxPercent").addEventListener("input", updateShortTermWarning);
el("issueLoadPercent").addEventListener("input", updateEffectiveIssueLoad);
el("issueLoadDiscountPercent").addEventListener("input", updateEffectiveIssueLoad);
el("fundIsin").addEventListener("input", updateOekbLink);

[el("amount"), el("insuranceRiskAnnual"), el("depotFeeAnnual")].forEach((input) => {
  input.addEventListener("blur", () => formatAmountInput(input));
});

form.addEventListener("input", (event) => {
  if (!event.target.closest("[data-export], [data-import], [data-reset]")) {
    resultsHost.hidden = true;
    setError();
  }
});

form.querySelector("[data-export]").addEventListener("click", async () => {
  setError();
  try {
    const inputs = collectInputs();
    const payload = createInsuranceFundCompareData({ inputs, toolboxVersion: TOOLBOX_VERSION, exportedAt: new Date().toISOString() });
    await saveJsonFile(payload, `fondsversicherung_vs_fondsdepot_${new Date().toISOString().slice(0, 10)}.json`);
  } catch (error) {
    setError(error instanceof Error ? error.message : String(error));
  }
});

form.querySelector("[data-import]").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  importFile.value = "";
  if (!file) return;
  setError();
  try {
    const payload = JSON.parse(await file.text());
    const normalized = normalizeInsuranceFundCompareData(payload);
    applyInputs(normalized.inputs);
    calculate();
  } catch (error) {
    setError(error instanceof Error ? error.message : String(error));
  }
});

form.querySelector("[data-reset]").addEventListener("click", () => {
  form.reset();
  el("amount").value = "100.000,00";
  el("insuranceRiskAnnual").value = "0,00";
  el("depotFeeAnnual").value = "0,00";
  updateProductPreset();
  updateDirectTaxFields();
  updateEffectiveIssueLoad();
  updateOekbLink();
  resultsHost.hidden = true;
  setError();
});

updateProductPreset();
updateDirectTaxFields();
updateEffectiveIssueLoad();
updateOekbLink();
