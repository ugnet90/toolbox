import {
  effectiveIssueLoadPercent,
  simulateInsuranceFundComparison,
  createInsuranceFundCompareData,
  normalizeInsuranceFundCompareData,
  suggestReturnScenarios
} from "./insurance-fund-compare-utils.js?v=0.7.1";

const TOOLBOX_VERSION = "0.7.1";
const DEPOT_COST_STORAGE_KEY = "toolbox:insurance-fund-compare:depot-costs:v1";

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

// Kuratierte Fondsreferenzen für die automatische Vorbelegung. Die Rendite ist eine
// historische BVI-Wertentwicklung und bereits NACH Fondskosten. Sie ist keine Prognose.
const FUND_PROFILES = [
  {
    name: "UniGlobal",
    aliases: ["uniglobal"],
    isin: "DE0008491051",
    issueLoadPercent: 5,
    historicalReturnPercent: 6.12,
    historicalPeriod: "seit Auflegung",
    historicalStand: "20.01.2025",
    historicalSource: "Union Investment",
    sourceUrl: "https://www.union-investment.at/unsere-services/aktuelles/nachrichten/65-jahre-uniglobal"
  },
  {
    name: "UniRak Konservativ ESG A",
    aliases: ["unirak konservativ esg a", "unirak konservativ esg", "unirak nachhaltig konservativ a", "unirak nachhaltig konservativ"],
    isin: "LU1572731245",
    issueLoadPercent: 2,
    historicalReturnPercent: null,
    historicalPeriod: "",
    historicalStand: "",
    historicalSource: "Union Investment",
    sourceUrl: "https://www.union-investment.at/fonds/fonds-finden"
  }
];

let returnAssumption = { mode: "manual", profile: null };

function el(id) { return document.getElementById(id); }

function parseGermanNumber(value) {
  let normalized = String(value ?? "").trim().replace(/[\s']/g, "");
  if (!normalized) return NaN;
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot ? normalized.replace(/\./g, "").replace(",", ".") : normalized.replace(/,/g, "");
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

function numberDe(value, digits = 2) {
  return new Intl.NumberFormat("de-AT", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value) || 0);
}

function formatAmountInput(input) {
  const value = parseGermanNumber(input.value);
  if (!Number.isFinite(value)) return;
  input.value = numberDe(value, 2);
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
    returnAssumptionMode: returnAssumption.mode,
    historicalReturnPercent: returnAssumption.profile?.historicalReturnPercent ?? null,
    historicalReturnStand: returnAssumption.mode === "historical" ? (returnAssumption.profile?.historicalStand || "") : "",
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

function setFormattedMinimum(value) {
  el("insuranceMinimumAmount").value = numberDe(value, 2);
}

function updateProductPreset({ preserveManual = false } = {}) {
  const preset = PRODUCT_PRESETS[el("insuranceProduct").value];
  if (!preset) return;
  if (!preserveManual) {
    setFormattedMinimum(preset.minimum);
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
  if (show) text.textContent = `Bei einer Auszahlung nach ${years} Jahr(en) liegt die Modelllaufzeit unter ${minYears} Jahren. Der Rechner berücksichtigt deshalb 7 % zusätzliche Versicherungssteuer; eine mögliche Differenz-ESt wird mit dem unten eingegebenen persönlichen Steuersatz modelliert.`;
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

function normalizeFundName(value) {
  return String(value ?? "").trim().toLocaleLowerCase("de-AT").replace(/\s+/g, " ");
}

function matchFundProfile() {
  const isin = el("fundIsin").value.trim().toUpperCase();
  const name = normalizeFundName(el("fundName").value);
  if (isin) {
    const byIsin = FUND_PROFILES.find((profile) => profile.isin === isin);
    if (byIsin) return byIsin;
  }
  if (!name) return null;
  return FUND_PROFILES.find((profile) => profile.aliases.includes(name) || normalizeFundName(profile.name) === name) || null;
}

function renderReturnSuggestion(profile = returnAssumption.profile) {
  const suggestionHost = document.querySelector("[data-return-suggestions]");
  const sourceHost = document.querySelector("[data-return-source]");
  if (!profile || !Number.isFinite(profile.historicalReturnPercent)) {
    suggestionHost.hidden = true;
    suggestionHost.innerHTML = "";
    sourceHost.textContent = "Individuelle Renditeannahme.";
    return;
  }

  const values = suggestReturnScenarios(profile.historicalReturnPercent);
  suggestionHost.innerHTML = values.map((value, index) => {
    const historical = index === 2;
    return `<button type="button" class="ifc-return-chip${historical ? " ifc-return-chip--historical" : ""}" data-return-value="${value}" data-return-kind="${historical ? "historical" : "scenario"}">${numberDe(value, historical ? 2 : 0)} %${historical ? " · historisch" : ""}</button>`;
  }).join("");
  suggestionHost.hidden = false;

  if (returnAssumption.mode === "historical") {
    sourceHost.innerHTML = `Historische Wertentwicklung: <strong>${numberDe(profile.historicalReturnPercent, 2)} % p.a.</strong> (${profile.historicalPeriod}) · Quelle: <a href="${profile.sourceUrl}" target="_blank" rel="noopener">${profile.historicalSource}</a> · Stand ${profile.historicalStand}<br><span>Vergangenheitswerte sind keine Prognose.</span>`;
  } else {
    sourceHost.textContent = "Individuelle Renditeannahme.";
  }
}

function applyFundProfile({ forceHistorical = true } = {}) {
  const profile = matchFundProfile();
  if (!profile) {
    returnAssumption = { mode: "manual", profile: null };
    renderReturnSuggestion(null);
    return;
  }
  if (!el("fundName").value.trim()) el("fundName").value = profile.name;
  if (!el("fundIsin").value.trim()) el("fundIsin").value = profile.isin;
  el("issueLoadPercent").value = String(profile.issueLoadPercent);
  updateEffectiveIssueLoad();
  updateOekbLink();

  if (forceHistorical && Number.isFinite(profile.historicalReturnPercent)) {
    el("grossReturnPercent").value = String(profile.historicalReturnPercent);
    returnAssumption = { mode: "historical", profile };
  } else {
    returnAssumption = { mode: "manual", profile };
  }
  renderReturnSuggestion(profile);
}

function loadDepotCostDefaults() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEPOT_COST_STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") return;
    if (Number.isFinite(Number(parsed.percent))) el("depotFeePercent").value = String(parsed.percent);
    if (Number.isFinite(Number(parsed.annual))) el("depotFeeAnnual").value = numberDe(Number(parsed.annual), 2);
  } catch { /* lokale Voreinstellung ist optional */ }
}

function saveDepotCostDefaults() {
  try {
    const percent = Number(el("depotFeePercent").value);
    const annual = parseGermanNumber(el("depotFeeAnnual").value);
    if (!Number.isFinite(percent) || !Number.isFinite(annual)) return;
    localStorage.setItem(DEPOT_COST_STORAGE_KEY, JSON.stringify({ percent, annual }));
  } catch { /* localStorage kann im Browser deaktiviert sein */ }
}

function comparisonClass(own, other, { higherIsBetter = false } = {}) {
  if (Math.abs(own - other) < 0.005) return "is-neutral";
  const ownBetter = higherIsBetter ? own > other : own < other;
  return ownBetter ? "is-better" : "is-worse";
}

function breakdownHtml(groups) {
  return groups.map((group) => `
    <section class="ifc-breakdown__section">
      <h3>${group.title}</h3>
      ${group.rows.map((row) => `<div class="ifc-breakdown__row ${row.className || ""}"><span>${row.label}</span><strong>${row.value}</strong></div>`).join("")}
    </section>`).join("");
}

function renderChart(history, comparison) {
  const host = document.querySelector("[data-chart]");
  const points = Array.isArray(history) ? history : [];
  if (!points.length) { host.innerHTML = ""; return; }

  const width = 900;
  const height = 340;
  const pad = { left: 72, right: 24, top: 34, bottom: 46 };
  const values = points.flatMap((p) => [p.insuranceNetValue, p.directNetValue, 0]);
  const maxValue = Math.max(...values) || 1;
  const minValue = Math.min(...values, 0);
  const firstYear = points[0].year;
  const lastYear = points[points.length - 1].year;
  const x = (year) => pad.left + ((year - firstYear) / Math.max(1, lastYear - firstYear)) * (width - pad.left - pad.right);
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
    .map((p) => `<text x="${x(p.year)}" y="${height - 14}" text-anchor="middle" class="ifc-chart-label">${p.year}</text>`).join("");

  let breakEvenMarkup = "";
  const breakEven = Number(comparison?.breakEvenYearApprox);
  if (Number.isFinite(breakEven) && breakEven >= firstYear && breakEven <= lastYear) {
    const bx = x(breakEven);
    let crossingValue = points[0].insuranceNetValue;
    const upperIndex = points.findIndex((point) => point.year >= breakEven);
    if (upperIndex > 0) {
      const lower = points[upperIndex - 1];
      const upper = points[upperIndex];
      const span = Math.max(1e-9, upper.year - lower.year);
      const fraction = (breakEven - lower.year) / span;
      const insuranceAtCrossing = lower.insuranceNetValue + (upper.insuranceNetValue - lower.insuranceNetValue) * fraction;
      const directAtCrossing = lower.directNetValue + (upper.directNetValue - lower.directNetValue) * fraction;
      crossingValue = (insuranceAtCrossing + directAtCrossing) / 2;
    } else if (upperIndex === 0) {
      crossingValue = (points[0].insuranceNetValue + points[0].directNetValue) / 2;
    }
    const by = y(crossingValue);
    breakEvenMarkup = `
      <line x1="${bx}" y1="${by}" x2="${bx}" y2="${height - pad.bottom}" class="ifc-break-even-line"/>
      <circle cx="${bx}" cy="${by}" r="4.5" class="ifc-break-even-point"/>
      <text x="${Math.min(width - 115, bx + 7)}" y="${Math.max(pad.top + 12, by - 9)}" class="ifc-break-even-label">Break-even ~ Jahr ${numberDe(breakEven, 1)}</text>`;
  }

  host.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Entwicklung der Nettoauszahlungswerte">
      <style>
        .ifc-chart-grid{stroke:var(--border);stroke-width:1}.ifc-chart-label{fill:var(--text-muted);font:12px system-ui,sans-serif}.ifc-chart-line-a{fill:none;stroke:var(--accent);stroke-width:3}.ifc-chart-line-b{fill:none;stroke:color-mix(in srgb,var(--accent) 45%,#9b7e25);stroke-width:3}.ifc-break-even-line{stroke:var(--text-muted);stroke-width:1.5;stroke-dasharray:6 5}.ifc-break-even-point{fill:var(--surface);stroke:var(--accent);stroke-width:3}.ifc-break-even-label{fill:var(--text);font:700 12px system-ui,sans-serif}
      </style>
      ${grid.join("")}
      <path d="${pathFor("insuranceNetValue")}" class="ifc-chart-line-a"/>
      <path d="${pathFor("directNetValue")}" class="ifc-chart-line-b"/>
      ${breakEvenMarkup}
      ${yearLabels}
      <text x="${(pad.left + width - pad.right) / 2}" y="${height - 1}" text-anchor="middle" class="ifc-chart-label">Jahr</text>
    </svg>`;
}

function renderResult(result) {
  document.querySelector("[data-insurance-end]").textContent = money(result.insurance.endValue);
  document.querySelector("[data-insurance-return]").textContent = `Netto-Effektivrendite ${pct(result.insurance.effectiveReturn * 100)} p.a.`;
  document.querySelector("[data-direct-end]").textContent = money(result.direct.endValue);
  document.querySelector("[data-direct-return]").textContent = `Netto-Effektivrendite ${pct(result.direct.effectiveReturn * 100)} p.a.`;

  const diff = result.comparison.difference;
  const winnerText = result.comparison.winner === "insurance" ? "Vorteil Fondsversicherung" : result.comparison.winner === "direct" ? "Vorteil Fondsdepot" : "Gleichstand";
  document.querySelector("[data-difference-label]").textContent = winnerText;
  document.querySelector("[data-difference]").textContent = result.comparison.winner === "equal" ? money(0) : `${diff >= 0 ? "+" : ""}${money(diff)}`;
  document.querySelector("[data-break-even]").textContent = result.comparison.breakEvenYear
    ? `Fondsversicherung erstmals ab Jahr ${result.comparison.breakEvenYear} vorne${Number.isFinite(result.comparison.breakEvenYearApprox) ? ` · Schnittpunkt ca. Jahr ${numberDe(result.comparison.breakEvenYearApprox, 1)}` : ""}`
    : "Kein Break-even zugunsten der Fondsversicherung innerhalb der Laufzeit";

  const costInsuranceClass = comparisonClass(result.insurance.totalCosts, result.direct.totalCosts);
  const costDirectClass = comparisonClass(result.direct.totalCosts, result.insurance.totalCosts);
  const taxInsuranceClass = comparisonClass(result.insurance.totalTaxes, result.direct.totalTaxes);
  const taxDirectClass = comparisonClass(result.direct.totalTaxes, result.insurance.totalTaxes);
  const endInsuranceClass = comparisonClass(result.insurance.endValue, result.direct.endValue, { higherIsBetter: true });
  const endDirectClass = comparisonClass(result.direct.endValue, result.insurance.endValue, { higherIsBetter: true });

  document.querySelector("[data-insurance-breakdown]").innerHTML = breakdownHtml([
    { title: "Start", rows: [
      { label: "Kundenaufwand", value: money(result.inputs.amount) },
      { label: "Nettoeinmalprämie nach VSt", value: money(result.insurance.initialNetPremium) }
    ]},
    { title: "Kosten", rows: [
      { label: "Abschlusskosten gesamt", value: money(result.insurance.entryCostCharged) },
      { label: "Verwaltungskosten gesamt", value: money(result.insurance.adminCosts) },
      { label: "Risikokosten gesamt", value: money(result.insurance.riskCosts) },
      { label: "Kosten gesamt", value: money(result.insurance.totalCosts), className: `is-summary ${costInsuranceClass}` }
    ]},
    { title: "Steuern", rows: [
      { label: "Versicherungssteuer bei Einzahlung", value: money(result.insurance.initialInsuranceTax) },
      { label: "Zusätzliche VSt bei frühem Ausstieg", value: money(result.insurance.additionalInsuranceTax) },
      { label: "Differenz-ESt bei frühem Ausstieg", value: money(result.insurance.incomeTax) },
      { label: "Steuern gesamt", value: money(result.insurance.totalTaxes), className: `is-summary ${taxInsuranceClass}` }
    ]},
    { title: "Ergebnis", rows: [
      { label: "Nettoendwert", value: money(result.insurance.endValue), className: `is-result ${endInsuranceClass}` }
    ]}
  ]);

  document.querySelector("[data-direct-breakdown]").innerHTML = breakdownHtml([
    { title: "Start", rows: [
      { label: "Kundenaufwand", value: money(result.inputs.amount) },
      { label: "Tatsächlich investiert", value: money(result.direct.initialInvestment) }
    ]},
    { title: "Kosten", rows: [
      { label: "Ausgabeaufschlag", value: money(result.direct.issueLoadCost) },
      { label: "Depotkosten gesamt", value: money(result.direct.depotCosts) },
      { label: "Kosten gesamt", value: money(result.direct.totalCosts), className: `is-summary ${costDirectClass}` }
    ]},
    { title: "Steuern", rows: [
      { label: "Unterjährige KESt (Modell)", value: money(result.direct.annualTaxes) },
      { label: "KESt bei Verkauf", value: money(result.direct.saleTax) },
      { label: "Steuern gesamt", value: money(result.direct.totalTaxes), className: `is-summary ${taxDirectClass}` }
    ]},
    { title: "Ergebnis", rows: [
      { label: "Nettoendwert", value: money(result.direct.endValue), className: `is-result ${endDirectClass}` }
    ]}
  ]);

  renderChart(result.history, result.comparison);
  resultsHost.hidden = false;
  resultsHost.scrollIntoView({ behavior: "smooth", block: "start" });
}

function calculate() {
  setError();
  try {
    const inputs = collectInputs();
    const result = simulateInsuranceFundComparison(inputs);
    saveDepotCostDefaults();
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
      const handle = await window.showSaveFilePicker({ suggestedName, types: [{ description: "JSON-Datei", accept: { "application/json": [".json"] } }] });
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

function restoreReturnMode(inputs) {
  const profile = matchFundProfile();
  if (!profile) {
    returnAssumption = { mode: "manual", profile: null };
    renderReturnSuggestion(null);
    return;
  }
  const mode = ["historical", "scenario", "manual"].includes(inputs?.returnAssumptionMode) ? inputs.returnAssumptionMode : "manual";
  returnAssumption = { mode, profile };
  renderReturnSuggestion(profile);
}

function applyInputs(inputs) {
  const setters = {
    amount: (v) => { el("amount").value = numberDe(Number(v), 2); },
    insuranceMinimumAmount: (v) => { el("insuranceMinimumAmount").value = numberDe(Number(v), 2); },
    insuranceRiskAnnual: (v) => { el("insuranceRiskAnnual").value = numberDe(Number(v), 2); },
    depotFeeAnnual: (v) => { el("depotFeeAnnual").value = numberDe(Number(v), 2); },
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
  restoreReturnMode(inputs);
}

form.addEventListener("submit", (event) => { event.preventDefault(); calculate(); });
el("insuranceProduct").addEventListener("change", () => updateProductPreset());
el("directTaxMode").addEventListener("change", updateDirectTaxFields);
el("age50Plus").addEventListener("change", updateShortTermWarning);
el("years").addEventListener("input", updateShortTermWarning);
el("insuranceTaxPercent").addEventListener("input", updateShortTermWarning);
el("issueLoadPercent").addEventListener("input", updateEffectiveIssueLoad);
el("issueLoadDiscountPercent").addEventListener("input", updateEffectiveIssueLoad);
el("fundIsin").addEventListener("input", updateOekbLink);

[el("amount"), el("insuranceMinimumAmount"), el("insuranceRiskAnnual"), el("depotFeeAnnual")].forEach((input) => {
  input.addEventListener("blur", () => formatAmountInput(input));
});

[el("depotFeePercent"), el("depotFeeAnnual")].forEach((input) => {
  input.addEventListener("change", saveDepotCostDefaults);
  input.addEventListener("blur", saveDepotCostDefaults);
});

el("fundName").addEventListener("input", () => {
  const profile = returnAssumption.profile;
  if (!profile) return;
  const name = normalizeFundName(el("fundName").value);
  const stillMatches = profile.aliases.includes(name) || normalizeFundName(profile.name) === name;
  if (!stillMatches) {
    if (el("fundIsin").value.trim().toUpperCase() === profile.isin) el("fundIsin").value = "";
    returnAssumption = { mode: "manual", profile: null };
    renderReturnSuggestion(null);
    updateOekbLink();
  }
});

el("fundIsin").addEventListener("input", () => {
  const profile = returnAssumption.profile;
  if (!profile) return;
  const isin = el("fundIsin").value.trim().toUpperCase();
  if (isin && isin !== profile.isin) {
    const name = normalizeFundName(el("fundName").value);
    if (profile.aliases.includes(name) || normalizeFundName(profile.name) === name) el("fundName").value = "";
    returnAssumption = { mode: "manual", profile: null };
    renderReturnSuggestion(null);
  }
});

[el("fundName"), el("fundIsin")].forEach((input) => {
  input.addEventListener("change", () => applyFundProfile({ forceHistorical: true }));
  input.addEventListener("blur", () => applyFundProfile({ forceHistorical: true }));
});

el("grossReturnPercent").addEventListener("input", () => {
  returnAssumption = { mode: "manual", profile: returnAssumption.profile || matchFundProfile() };
  renderReturnSuggestion(returnAssumption.profile);
});

document.querySelector("[data-return-suggestions]").addEventListener("click", (event) => {
  const button = event.target.closest("[data-return-value]");
  if (!button) return;
  const value = Number(button.dataset.returnValue);
  if (!Number.isFinite(value)) return;
  el("grossReturnPercent").value = String(value);
  returnAssumption = { mode: button.dataset.returnKind === "historical" ? "historical" : "scenario", profile: returnAssumption.profile || matchFundProfile() };
  renderReturnSuggestion(returnAssumption.profile);
  resultsHost.hidden = true;
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
  } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
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
  } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
});

form.querySelector("[data-reset]").addEventListener("click", () => {
  form.reset();
  el("amount").value = "100.000,00";
  el("insuranceRiskAnnual").value = "0,00";
  el("depotFeeAnnual").value = "0,00";
  loadDepotCostDefaults();
  returnAssumption = { mode: "manual", profile: null };
  renderReturnSuggestion(null);
  updateProductPreset();
  updateDirectTaxFields();
  updateEffectiveIssueLoad();
  updateOekbLink();
  resultsHost.hidden = true;
  setError();
});

loadDepotCostDefaults();
updateProductPreset();
updateDirectTaxFields();
updateEffectiveIssueLoad();
updateOekbLink();
renderReturnSuggestion(null);
