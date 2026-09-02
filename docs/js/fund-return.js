import { SITE_VERSION } from "./site-map.js";
import {
  applyKestExemption,
  calculateXirr,
  createFundReturnData,
  detectRecurringSavingsPlans,
  formatGermanNumber,
  generateRecurringDates,
  initialInvestment,
  normalizeFundReturnData,
  parseBankTransactionsCsv,
  parseGermanNumber,
  simulateHistoricalRateBenchmark,
  summarizeCashflows
} from "./fund-return-utils.js";

const DATA_PROXY = "https://toolbox-bundesschatz-proxy.daniel-koechler.workers.dev";
const BENCHMARKS = {
  overnight: {
    endpoint: "/savings-rates",
    label: "Historische Spareinlage",
    shortLabel: "Spareinlage",
    taxPercent: 25,
    seriesLabel: "historische Spareinlagen-Zinsen",
    methodText: "Der historische Sparvergleich verwendet die monatliche ECB-MIR-Serie für täglich fällige österreichische Haushaltseinlagen. Der jeweilige Jahreszinssatz wird taggenau (act/365) auf das alternative Sparguthaben angewendet."
  },
  euribor3m: {
    endpoint: "/euribor-3m",
    label: "3-Monats-Euribor",
    shortLabel: "3M-Euribor",
    taxPercent: 25,
    seriesLabel: "3-Monats-Euribor-Daten",
    methodText: "Der 3-Monats-Euribor-Vergleich verwendet den monatlichen Durchschnitt der offiziellen ECB-Serie FM.M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA. Der Jahreszinssatz wird taggenau (act/365) auf ein fiktives Sparguthaben angewendet."
  },
  euribor6m: {
    endpoint: "/euribor-6m",
    label: "6-Monats-Euribor",
    shortLabel: "6M-Euribor",
    taxPercent: 25,
    seriesLabel: "6-Monats-Euribor-Daten",
    methodText: "Der 6-Monats-Euribor-Vergleich verwendet den monatlichen Durchschnitt der offiziellen ECB-Serie FM.M.U2.EUR.RT.MM.EURIBOR6MD_.HSTA und behandelt ihn als fiktives Sparprodukt."
  },
  euribor12m: {
    endpoint: "/euribor-12m",
    label: "12-Monats-Euribor",
    shortLabel: "12M-Euribor",
    taxPercent: 25,
    seriesLabel: "12-Monats-Euribor-Daten",
    methodText: "Der 12-Monats-Euribor-Vergleich verwendet den monatlichen Durchschnitt der offiziellen ECB-Serie FM.M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA und behandelt ihn als fiktives Sparprodukt."
  }
};

const form = document.querySelector("[data-fund-form]");
const errorNode = document.querySelector("[data-fund-error]");
const warningNode = document.querySelector("[data-fund-warning]");
const resultsNode = document.querySelector("[data-fund-results]");
const detailsNode = document.querySelector("[data-fund-details]");
const cashflowBody = document.querySelector("[data-cashflow-body]");
const cashflowTableWrap = document.querySelector("[data-cashflow-table-wrap]");
const cashflowList = document.querySelector("[data-cashflow-list]");
const cashflowSummary = document.querySelector("[data-cashflow-summary]");
const ignoredKestDetail = document.querySelector("[data-ignored-kest-detail]");
const comparisonChart = document.querySelector("[data-comparison-chart]");
const valueChart = document.querySelector("[data-value-chart]");
const returnChart = document.querySelector("[data-return-chart]");
const resetButton = document.querySelector("[data-reset-fund]");
const printButton = document.querySelector("[data-print-fund]");
const printReport = document.querySelector("[data-print-report]");
const printOptions = document.querySelector("[data-print-options]");
const printCashflows = document.querySelector("[data-print-cashflows]");
const printConfirmButton = document.querySelector("[data-print-confirm]");
const printCancelButton = document.querySelector("[data-print-cancel]");
const importButton = document.querySelector("[data-import-fund]");
const exportButton = document.querySelector("[data-export-fund]");
const importFileInput = document.querySelector("[data-import-fund-file]");
const csvImportButton = document.querySelector("[data-import-bank-csv]");
const csvImportFileInput = document.querySelector("[data-import-bank-csv-file]");
const dataStatusNode = document.querySelector("[data-fund-data-status]");
const savingsPlanSummary = document.querySelector("[data-savings-plan-summary]");
const savingsPlanList = document.querySelector("[data-savings-plan-list]");
const benchmarkCheckboxes = [...document.querySelectorAll("[data-benchmark-checkbox]")];

const benchmarkCards = Object.fromEntries(
  Object.keys(BENCHMARKS).map((kind) => [kind, document.querySelector(`[data-benchmark-card="${kind}"]`)])
);

const benchmarkNodes = Object.fromEntries(
  Object.keys(BENCHMARKS).map((kind) => [kind, {
    rate: document.querySelector(`[data-benchmark-rate="${kind}"]`),
    meta: document.querySelector(`[data-benchmark-meta="${kind}"]`),
    end: document.querySelector(`[data-benchmark-end="${kind}"]`),
    xirr: document.querySelector(`[data-benchmark-xirr="${kind}"]`),
    interest: document.querySelector(`[data-benchmark-interest="${kind}"]`),
    tax: document.querySelector(`[data-benchmark-tax="${kind}"]`),
    difference: document.querySelector(`[data-benchmark-difference="${kind}"]`),
    coverage: document.querySelector(`[data-rate-coverage="${kind}"]`),
    details: [...document.querySelectorAll(`[data-benchmark-detail="${kind}"]`)]
  }])
);

const designation = document.querySelector("#designation");
const purchaseDate = document.querySelector("#purchaseDate");
const initialAmount = document.querySelector("#initialAmount");
const initialAmountMode = document.querySelector("#initialAmountMode");
const purchaseFee = document.querySelector("#purchaseFee");
const endDate = document.querySelector("#endDate");
const endValue = document.querySelector("#endValue");
const kestExemption = document.querySelector("#kestExemption");

const cashflowDate = document.querySelector("#cashflowDate");
const cashflowType = document.querySelector("#cashflowType");
const cashflowAmount = document.querySelector("#cashflowAmount");
const cashflowTitle = document.querySelector("#cashflowTitle");
const cashflowNote = document.querySelector("#cashflowNote");

const recurringType = document.querySelector("#recurringType");
const recurringAmount = document.querySelector("#recurringAmount");
const recurringInterval = document.querySelector("#recurringInterval");
const recurringFirst = document.querySelector("#recurringFirst");
const recurringLast = document.querySelector("#recurringLast");
const recurringTitle = document.querySelector("#recurringTitle");
const recurringNote = document.querySelector("#recurringNote");

const nodes = {
  xirr: document.querySelector("[data-xirr]"),
  economicResult: document.querySelector("[data-economic-result]"),
  startOutflow: document.querySelector("[data-start-outflow]"),
  startNet: document.querySelector("[data-start-net]"),
  startFee: document.querySelector("[data-start-fee]"),
  otherOutflows: document.querySelector("[data-other-outflows]"),
  intermediateInflows: document.querySelector("[data-intermediate-inflows]"),
  terminalValue: document.querySelector("[data-terminal-value]"),
  cashflowCount: document.querySelector("[data-cashflow-count]"),
  kestStatus: document.querySelector("[data-kest-status]"),
  ignoredKest: document.querySelector("[data-ignored-kest]"),
  method: document.querySelector("[data-fund-method]")
};

function setText(node, value) {
  if (node) node.textContent = value;
}

const currency = new Intl.NumberFormat("de-AT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const percent = new Intl.NumberFormat("de-AT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const typeLabels = {
  contribution: "Zuzahlung / Sparrate",
  distribution: "Ausschüttung",
  tax: "KESt / Steuer auf agE",
  fee: "Depot-/sonstige Gebühr",
  withdrawal: "Entnahme",
  other: "Sonstiger Cashflow"
};

const defaultNegativeTypes = new Set(["contribution", "tax", "fee"]);
let cashflows = [];
let nextCashflowId = 1;
let calculationRevision = 0;
let lastCoreCalculation = null;

function isTouchDateEnvironment() {
  return navigator.maxTouchPoints > 0 && window.matchMedia?.("(pointer: coarse)")?.matches;
}

function isoToGermanDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

function germanDateToIso(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let day;
  let month;
  let year;
  const compact = raw.replace(/\D/g, "");
  if (compact.length === 8) {
    day = Number(compact.slice(0, 2));
    month = Number(compact.slice(2, 4));
    year = Number(compact.slice(4, 8));
  } else {
    const match = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
    if (!match) return null;
    day = Number(match[1]);
    month = Number(match[2]);
    year = Number(match[3]);
  }
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const enhancedDateInputs = new Map();

function enhanceDateInput(nativeInput) {
  if (!nativeInput || enhancedDateInputs.has(nativeInput) || !isTouchDateEnvironment()) return;
  const wrapper = document.createElement("div");
  wrapper.className = "manual-date-control";

  const textInput = document.createElement("input");
  textInput.type = "text";
  textInput.inputMode = "numeric";
  textInput.autocomplete = "off";
  textInput.placeholder = "TT.MM.JJJJ";
  textInput.className = nativeInput.classList.contains("table-input") ? "table-input manual-date-control__text" : "manual-date-control__text";
  textInput.value = isoToGermanDate(nativeInput.value);
  textInput.id = nativeInput.id ? `${nativeInput.id}Text` : "";
  textInput.setAttribute("aria-label", nativeInput.getAttribute("aria-label") || "Datum");

  const pickerButton = document.createElement("button");
  pickerButton.type = "button";
  pickerButton.className = "manual-date-control__picker";
  pickerButton.tabIndex = -1;
  pickerButton.setAttribute("aria-label", "Kalender öffnen");
  pickerButton.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 2v3M17 2v3M3.5 9h17M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 19 20.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5Z"/></svg>';

  nativeInput.parentNode.insertBefore(wrapper, nativeInput);
  wrapper.append(textInput, pickerButton, nativeInput);
  nativeInput.classList.add("manual-date-control__native");
  nativeInput.tabIndex = -1;

  if (nativeInput.id) {
    document.querySelectorAll(`label[for="${CSS.escape(nativeInput.id)}"]`).forEach((label) => {
      label.htmlFor = textInput.id;
    });
  }

  function commitTextValue() {
    const iso = germanDateToIso(textInput.value);
    if (iso === null) {
      textInput.setCustomValidity("Bitte Datum im Format TT.MM.JJJJ eingeben.");
      return false;
    }
    textInput.setCustomValidity("");
    nativeInput.value = iso;
    textInput.value = isoToGermanDate(iso);
    nativeInput.dispatchEvent(new Event("input", { bubbles: true }));
    nativeInput.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  textInput.addEventListener("input", () => {
    textInput.setCustomValidity("");
    const digits = textInput.value.replace(/\D/g, "").slice(0, 8);
    if (/^\d{3,8}$/.test(digits)) {
      let formatted = digits.slice(0, 2);
      if (digits.length > 2) formatted += `.${digits.slice(2, 4)}`;
      if (digits.length > 4) formatted += `.${digits.slice(4, 8)}`;
      textInput.value = formatted;
    }
  });
  textInput.addEventListener("blur", () => {
    if (!textInput.value.trim()) {
      nativeInput.value = "";
      nativeInput.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    commitTextValue();
  });
  textInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") commitTextValue();
  });

  nativeInput.addEventListener("change", () => {
    textInput.value = isoToGermanDate(nativeInput.value);
    textInput.setCustomValidity("");
  });

  pickerButton.addEventListener("click", () => {
    try {
      if (typeof nativeInput.showPicker === "function") nativeInput.showPicker();
      else {
        nativeInput.focus({ preventScroll: true });
        nativeInput.click();
      }
    } catch {
      nativeInput.click();
    }
  });

  enhancedDateInputs.set(nativeInput, textInput);
}

function enhanceDateInputs(root = document) {
  if (!isTouchDateEnvironment()) return;
  root.querySelectorAll('input[type="date"]').forEach(enhanceDateInput);
}

function syncEnhancedDateInputs() {
  enhancedDateInputs.forEach((textInput, nativeInput) => {
    textInput.value = isoToGermanDate(nativeInput.value);
    textInput.setCustomValidity("");
  });
}

function normalizeSignedAmount(rawValue, type) {
  const amount = parseGermanNumber(rawValue);
  if (!Number.isFinite(amount) || amount === 0) throw new Error("Bitte einen Betrag ungleich 0 eingeben.");
  if (defaultNegativeTypes.has(type) && amount > 0) return -amount;
  return amount;
}

function formatAmountInput(input) {
  if (!input?.value.trim()) return;
  const value = parseGermanNumber(input.value);
  if (Number.isFinite(value)) input.value = formatGermanNumber(value);
}

function clearCalculation() {
  calculationRevision += 1;
  if (dataStatusNode) {
    dataStatusNode.hidden = true;
    dataStatusNode.textContent = "";
  }
  if (errorNode) {
    errorNode.hidden = true;
    errorNode.textContent = "";
  }
  if (warningNode) {
    warningNode.hidden = true;
    warningNode.textContent = "";
  }
  if (resultsNode) resultsNode.hidden = true;
  if (detailsNode) {
    detailsNode.hidden = true;
    detailsNode.open = false;
  }
  Object.values(benchmarkCards).forEach((card) => { if (card) card.hidden = true; });
  Object.values(benchmarkNodes).forEach((group) => {
    group.details.forEach((node) => { node.hidden = true; });
  });
  if (ignoredKestDetail) ignoredKestDetail.hidden = true;
  if (comparisonChart) comparisonChart.hidden = true;
  if (savingsPlanSummary) savingsPlanSummary.hidden = true;
  if (savingsPlanList) savingsPlanList.innerHTML = "";
  lastCoreCalculation = null;
  if (valueChart) valueChart.innerHTML = "";
  if (returnChart) returnChart.innerHTML = "";
  if (printButton) printButton.hidden = true;
  if (printReport) printReport.innerHTML = "";
}

function showError(message) {
  if (!errorNode) return;
  errorNode.textContent = message;
  errorNode.hidden = false;
}

function showWarning(message) {
  if (!warningNode) return;
  warningNode.textContent = message;
  warningNode.hidden = false;
}

function appendWarning(message) {
  if (!warningNode) return;
  const current = warningNode.hidden ? "" : warningNode.textContent.trim();
  warningNode.textContent = current ? `${current} ${message}` : message;
  warningNode.hidden = false;
}

function showDataStatus(message) {
  if (!dataStatusNode) return;
  dataStatusNode.textContent = message;
  dataStatusNode.hidden = false;
}

function selectedBenchmarkKinds() {
  return benchmarkCheckboxes.filter((box) => box.checked).map((box) => box.value).filter((key) => BENCHMARKS[key]);
}

function currentFundData() {
  const initial = parseGermanNumber(initialAmount?.value);
  const terminal = parseGermanNumber(endValue?.value);
  const fee = Number(purchaseFee?.value || 0);

  return createFundReturnData({
    toolboxVersion: SITE_VERSION,
    exportedAt: new Date().toISOString(),
    inputs: {
      designation: designation?.value?.trim() || "",
      purchaseDate: purchaseDate?.value,
      initialAmount: initial,
      initialAmountMode: initialAmountMode?.value,
      purchaseFeePercent: fee,
      endDate: endDate?.value,
      endValue: terminal,
      benchmarkKinds: selectedBenchmarkKinds(),
      kestExemption: kestExemption?.value
    },
    cashflows: cashflows.map(({ date, type, amount, title, note }) => ({ date, type, amount, title: title || "", note: note || "" }))
  });
}

function safeFilenamePart(value) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_")
    .replace(/[^0-9A-Za-zÄÖÜäöüß_-]/g, "")
    .slice(0, 70);
}

function exportFilename() {
  const suffix = endDate?.value || new Date().toISOString().slice(0, 10);
  const name = safeFilenamePart(designation?.value);
  return `toolbox_depotrendite${name ? `_${name}` : ""}_${suffix}.json`;
}

function downloadJsonFallback(text, filename) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function saveJsonFile(data) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  const filename = exportFilename();

  if (window.isSecureContext && typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        id: "toolbox-depot-return-export",
        suggestedName: filename,
        types: [{
          description: "Toolbox Depotrendite (JSON)",
          accept: { "application/json": [".json"] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return { saved: true, picker: true };
    } catch (error) {
      if (error?.name === "AbortError") return { saved: false, cancelled: true };
      throw error;
    }
  }

  downloadJsonFallback(text, filename);
  return { saved: true, picker: false };
}

function applyImportedFundData(data) {
  const normalized = normalizeFundReturnData(data);
  form?.reset();

  designation.value = normalized.inputs.designation || "";
  purchaseDate.value = normalized.inputs.purchaseDate;
  initialAmount.value = formatGermanNumber(normalized.inputs.initialAmount);
  initialAmountMode.value = normalized.inputs.initialAmountMode;
  purchaseFee.value = String(normalized.inputs.purchaseFeePercent);
  endDate.value = normalized.inputs.endDate;
  endValue.value = formatGermanNumber(normalized.inputs.endValue);
  kestExemption.value = normalized.inputs.kestExemption;
  const wanted = new Set(normalized.inputs.benchmarkKinds || []);
  benchmarkCheckboxes.forEach((box) => { box.checked = wanted.has(box.value); });

  nextCashflowId = 1;
  cashflows = normalized.cashflows.map((flow) => ({ ...flow, id: nextCashflowId++ }));
  renderCashflows();
  syncEnhancedDateInputs();
  clearCalculation();
  const flowLabel = cashflows.length === 1 ? "1 zusätzlicher Zahlungsstrom" : `${cashflows.length} zusätzliche Zahlungsströme`;
  showDataStatus(`Daten importiert: ${flowLabel}. Bitte Depotrendite neu berechnen.`);
}


function decodeCsvBuffer(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

async function importBankTransactionsCsv(file) {
  if (file.size > 5_000_000) throw new Error("Die CSV-Datei ist zu groß.");
  const text = decodeCsvBuffer(await file.arrayBuffer());
  const parsed = parseBankTransactionsCsv(text);
  const hadExisting = cashflows.length > 0;
  for (const flow of parsed.cashflows) {
    cashflows.push({ ...flow, id: nextCashflowId++ });
  }
  renderCashflows();
  clearCalculation();

  const count = parsed.cashflows.length;
  const label = count === 1 ? "1 Buchung" : `${count} Buchungen`;
  const skipped = parsed.skippedZeroAmounts > 0 ? ` ${parsed.skippedZeroAmounts} Nullbuchung(en) wurden übersprungen.` : "";
  showDataStatus(`${label} aus CSV importiert${hadExisting ? " und zu den bestehenden Zahlungsströmen hinzugefügt" : ""}.${skipped} Bitte Depotrendite neu berechnen.`);
  if (parsed.unknownBusinessTypes > 0) {
    appendWarning(`${parsed.unknownBusinessTypes} unbekannte Geschäftsart(en) wurden als „Sonstiger Cashflow“ übernommen; Originaltext steht in der Notiz.`);
  }
  if (parsed.normalizedOutflowSigns > 0) {
    appendWarning(`${parsed.normalizedOutflowSigns} als Belastung erkannte positive Buchungsbeträge wurden automatisch mit negativem Vorzeichen übernommen.`);
  }
  if (!parsed.hasTitleColumn) {
    appendWarning("Die CSV-Datei enthält keine Spalte „Titel“. Eine fondsbezogene Sparplan-Erkennung ist daher für diese Buchungen nicht möglich.");
  }
}

function typeOptions(selected) {
  return Object.entries(typeLabels).map(([value, label]) =>
    `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`
  ).join("");
}

function renderCashflows() {
  if (!cashflowBody || !cashflowTableWrap) return;
  cashflowBody.innerHTML = "";
  const ordered = [...cashflows].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  for (const flow of ordered) {
    const row = document.createElement("tr");
    row.dataset.cashflowId = String(flow.id);
    row.innerHTML = `
      <td><input class="table-input table-input--date" type="date" value="${flow.date}" data-flow-field="date" aria-label="Datum"></td>
      <td><select class="table-input" data-flow-field="type" aria-label="Art">${typeOptions(flow.type)}</select></td>
      <td><input class="table-input table-input--amount" type="text" inputmode="decimal" value="${formatGermanNumber(flow.amount)}" data-flow-field="amount" aria-label="Betrag"></td>
      <td><input class="table-input" type="text" maxlength="120" value="${escapeHtml(flow.title || "")}" data-flow-field="title" aria-label="Titel"></td>
      <td><input class="table-input" type="text" maxlength="120" value="${escapeHtml(flow.note || "")}" data-flow-field="note" aria-label="Notiz"></td>
      <td><button class="icon-button" type="button" data-delete-cashflow="${flow.id}" aria-label="Zahlung löschen">×</button></td>
    `;
    cashflowBody.append(row);
  }

  if (cashflowList) {
    cashflowList.hidden = cashflows.length === 0;
    if (cashflowSummary) cashflowSummary.textContent = cashflows.length === 1 ? "1 Zahlungsstrom anzeigen" : `${cashflows.length} Zahlungsströme anzeigen`;
  }
  enhanceDateInputs(cashflowBody);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function addCashflow({ date, type, amount, title = "", note = "" }) {
  if (!date) throw new Error("Bitte ein Datum für den Zahlungsstrom eingeben.");
  const signedAmount = normalizeSignedAmount(amount, type);
  cashflows.push({ id: nextCashflowId++, date, type, amount: signedAmount, title: title.trim(), note: note.trim() });
  renderCashflows();
  clearCalculation();
}

function monthFromDate(iso) {
  return String(iso).slice(0, 7);
}

async function fetchBenchmarkRates(kind, startIso, endIso) {
  const config = BENCHMARKS[kind];
  if (!config) throw new Error("Unbekannter historischer Benchmark.");

  const url = new URL(`${DATA_PROXY}${config.endpoint}`);
  url.searchParams.set("start", monthFromDate(startIso));
  url.searchParams.set("end", monthFromDate(endIso));

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.observations?.length) {
    throw new Error(body?.error || `${config.label} konnte nicht geladen werden.`);
  }
  return { config, apiData: body };
}

function buildCalculation() {
  const startDate = purchaseDate.value;
  const finishDate = endDate.value;
  if (!startDate || !finishDate) throw new Error("Bitte Start- und Enddatum eingeben.");
  if (finishDate <= startDate) throw new Error("Das Enddatum muss nach dem Startdatum liegen.");

  const start = initialInvestment({
    amount: parseGermanNumber(initialAmount.value),
    amountMode: initialAmountMode.value,
    purchaseFeePercent: Number(purchaseFee.value)
  });
  const terminalValue = parseGermanNumber(endValue.value);
  if (!Number.isFinite(terminalValue) || terminalValue < 0) {
    throw new Error("Der End-/Verkaufswert muss mindestens 0 sein.");
  }

  const enteredIntermediate = [...cashflows].sort((a, b) => a.date.localeCompare(b.date));
  if (enteredIntermediate.some((flow) => flow.date < startDate || flow.date > finishDate)) {
    throw new Error("Alle weiteren Zahlungsströme müssen zwischen Start- und Enddatum liegen.");
  }

  const isKestExempt = kestExemption?.value === "yes";
  const kestAdjusted = applyKestExemption(enteredIntermediate, isKestExempt);
  const intermediate = kestAdjusted.cashflows;

  const investorFlows = [
    { date: startDate, amount: -start.customerOutflow, type: "start", note: "Startinvestition" },
    ...intermediate.map((flow) => ({ ...flow })),
    { date: finishDate, amount: terminalValue, type: "terminal", note: "End-/Verkaufswert" }
  ];

  const benchmarkFlows = investorFlows.filter((flow) => flow.type !== "terminal");
  return {
    start,
    terminalValue,
    investorFlows,
    benchmarkFlows,
    startDate,
    finishDate,
    intermediate,
    enteredIntermediate,
    isKestExempt,
    ignoredKestCashflows: kestAdjusted.ignoredTaxCashflows,
    ignoredKestNet: kestAdjusted.ignoredTaxNet
  };
}

function renderCoreResults(calc, xirrResult) {
  const summary = summarizeCashflows(calc.investorFlows);
  const intermediateSummary = summarizeCashflows(calc.intermediate);
  setText(nodes.xirr, `${percent.format(xirrResult.rate * 100)} % p.a.`);
  setText(nodes.economicResult, currency.format(summary.net));
  setText(nodes.startOutflow, currency.format(calc.start.customerOutflow));
  setText(nodes.startNet, currency.format(calc.start.netInvested));
  setText(nodes.startFee, currency.format(calc.start.feeAmount));
  setText(nodes.otherOutflows, currency.format(Math.max(intermediateSummary.outflows, 0)));
  setText(nodes.intermediateInflows, currency.format(Math.max(intermediateSummary.inflows, 0)));
  setText(nodes.terminalValue, currency.format(calc.terminalValue));
  setText(nodes.cashflowCount, String(calc.investorFlows.length));
  setText(nodes.kestStatus, calc.isKestExempt ? "Ja – KESt-Abzug nicht berücksichtigt" : "Nein");
  if (ignoredKestDetail) {
    ignoredKestDetail.hidden = !calc.isKestExempt || calc.ignoredKestCashflows.length === 0;
  }
  setText(nodes.ignoredKest, currency.format(calc.ignoredKestNet));

  const multipleRootText = xirrResult.rootCount > 1
    ? " Die Zahlungsstromfolge besitzt mehrere mathematisch mögliche IRR-Lösungen; angezeigt wird die betragsmäßig nächstliegende Lösung zu 0 %."
    : "";

  const kestMethodText = calc.isKestExempt
    ? " Eine wirksame KESt-Befreiungserklärung wurde angesetzt; als KESt/Steuer auf agE kategorisierte Cashflows werden in der Depotrendite nicht berücksichtigt. Dies bildet nur den KESt-Abzug ab, nicht Körperschaftsteuer oder andere Steuern."
    : " Eine KESt-Befreiungserklärung wurde nicht angesetzt; erfasste Steuer-Cashflows wirken daher wie eingegeben auf die Depotrendite.";
  setText(nodes.method, `Die Depotrendite wird als datumsgenaue XIRR aus allen berücksichtigten Anleger-Cashflows berechnet. Der Start-Cashflow entspricht dem tatsächlichen Kundenaufwand; Kaufspesen beeinflussen daher die Rendite, ohne dass eine vollständige Fondsbesteuerung modelliert wird.${kestMethodText}${multipleRootText}`);
  if (calc.isKestExempt && calc.ignoredKestCashflows.length > 0) {
    appendWarning(`Hinweis: ${calc.ignoredKestCashflows.length} als KESt/Steuer auf agE erfasste Cashflow(s) werden wegen der aktivierten KESt-Befreiung nicht berücksichtigt.`);
  }
  if (xirrResult.rootCount > 1) {
    appendWarning("Hinweis: Für diese Zahlungsstromfolge existieren mehrere mathematisch mögliche Effektivzinssätze. Details beachten.");
  }

  if (resultsNode) resultsNode.hidden = false;
  if (detailsNode) detailsNode.hidden = false;
  calc.baseMethodText = nodes.method?.textContent || "";
}

function renderSavingsPlanSummary(sourceCashflows) {
  if (!savingsPlanSummary || !savingsPlanList) return;
  const plans = detectRecurringSavingsPlans(sourceCashflows);
  savingsPlanList.innerHTML = "";
  if (!plans.length) {
    savingsPlanSummary.hidden = true;
    return;
  }
  for (const plan of plans) {
    const item = document.createElement("li");
    item.textContent = `Fondssparvertrag ${plan.title}: monatlich ca. ${currency.format(plan.nominalAmount)} (${formatReportDate(plan.firstDate)} – ${formatReportDate(plan.lastDate)}), ${plan.count} Buchungen.`;
    savingsPlanList.append(item);
  }
  savingsPlanSummary.hidden = false;
}

function benchmarkXirr(calc, benchmark) {
  return calculateXirr([
    ...calc.benchmarkFlows.map((flow) => ({ ...flow })),
    { date: calc.finishDate, amount: benchmark.balance, type: "terminal", note: "Benchmark-Endwert" }
  ]);
}

function renderBenchmark(calc, kind, config, apiData, benchmark, effectiveTaxPercent) {
  const group = benchmarkNodes[kind];
  const card = benchmarkCards[kind];
  const difference = calc.terminalValue - benchmark.balance;
  const coverage = benchmark.rateCoverage;
  const xirrResult = benchmarkXirr(calc, benchmark);

  setText(group?.rate, `${percent.format(xirrResult.rate * 100)} % p.a.`);
  setText(group?.meta, `Endwert ${currency.format(benchmark.balance)} · ${effectiveTaxPercent === 0 ? "0 % KESt" : "nach 25 % KESt"}`);
  setText(group?.end, currency.format(benchmark.balance));
  setText(group?.xirr, `${percent.format(xirrResult.rate * 100)} % p.a.`);
  setText(group?.interest, currency.format(benchmark.grossInterest));
  setText(group?.tax, currency.format(benchmark.tax));
  setText(group?.difference, `${difference >= 0 ? "+" : ""}${currency.format(difference)}`);

  if (coverage?.carriedForward) {
    setText(group?.coverage, `${coverage.firstOfficialPeriod} bis ${coverage.lastOfficialPeriod}; ab ${coverage.lastOfficialPeriod} mit ${percent.format(coverage.carriedRate)} % p.a. bis ${coverage.requiredEndPeriod} fortgeführt`);
    appendWarning(`Hinweis: Offizielle ECB-Daten für „${config.label}“ sind nur bis ${coverage.lastOfficialPeriod} verfügbar. Für die Zeit danach bis ${coverage.requiredEndPeriod} wurde der zuletzt verfügbare Zinssatz von ${percent.format(coverage.carriedRate)} % p.a. unverändert fortgeführt.`);
  } else {
    setText(group?.coverage, `${apiData.first_period} bis ${apiData.last_period}`);
  }

  if (card) card.hidden = false;
  group?.details.forEach((node) => { node.hidden = false; });

  const benchmarkTaxText = effectiveTaxPercent === 0
    ? " Wegen der aktivierten KESt-Befreiungserklärung wird im Benchmark kein KESt-Abzug vorgenommen."
    : " Positive Zinsen werden zum Jahresende bzw. Vergleichsende mit 25 % KESt belastet.";
  if (nodes.method) nodes.method.textContent += ` ${config.methodText}${benchmarkTaxText}`;
  if (coverage?.carriedForward && nodes.method) {
    nodes.method.textContent += ` Nach dem letzten verfügbaren ECB-Monat ${coverage.lastOfficialPeriod} wird dessen Zinssatz unverändert bis zum Vergleichsende fortgeschrieben.`;
  }

  return { kind, config, benchmark, xirrResult, effectiveTaxPercent };
}

function appendSimpleBar(container, label, value, maxValue, category) {
  if (!container) return;
  const row = document.createElement("div");
  row.className = `comparison-bar-row comparison-bar-row--${category}${category === "fund" ? "" : " comparison-bar-row--benchmark"}`;
  const safeMax = Math.max(maxValue, 0.000001);
  const width = Math.max(0, Math.min(100, (Math.max(value, 0) / safeMax) * 100));
  row.innerHTML = `
    <div class="comparison-bar-row__label"></div>
    <div class="comparison-bar-row__track"><div class="comparison-bar-row__bar"></div></div>
    <strong class="comparison-bar-row__value"></strong>
  `;
  setText(row.querySelector(".comparison-bar-row__label"), label);
  setText(row.querySelector(".comparison-bar-row__value"), currency.format(value));
  row.querySelector(".comparison-bar-row__bar").style.width = `${width}%`;
  container.append(row);
}

function appendReturnBar(container, label, rate, minRate, maxRate, category) {
  if (!container) return;
  const row = document.createElement("div");
  row.className = `comparison-bar-row comparison-bar-row--return comparison-bar-row--${category}${category === "fund" ? "" : " comparison-bar-row--benchmark"}`;
  const low = Math.min(minRate, 0);
  const high = Math.max(maxRate, 0);
  const range = Math.max(high - low, 0.000001);
  const zero = ((0 - low) / range) * 100;
  const point = ((rate - low) / range) * 100;
  const left = Math.min(zero, point);
  const width = Math.max(1, Math.abs(point - zero));
  row.innerHTML = `
    <div class="comparison-bar-row__label"></div>
    <div class="comparison-bar-row__track comparison-bar-row__track--return">
      <span class="comparison-bar-row__zero"></span>
      <div class="comparison-bar-row__bar"></div>
    </div>
    <strong class="comparison-bar-row__value"></strong>
  `;
  setText(row.querySelector(".comparison-bar-row__label"), label);
  setText(row.querySelector(".comparison-bar-row__value"), `${percent.format(rate * 100)} %`);
  const zeroNode = row.querySelector(".comparison-bar-row__zero");
  zeroNode.style.left = `${zero}%`;
  const bar = row.querySelector(".comparison-bar-row__bar");
  bar.style.left = `${left}%`;
  bar.style.width = `${width}%`;
  if (rate < 0) bar.classList.add("is-negative");
  container.append(row);
}

function renderComparisonCharts(calc, fundXirrResult, benchmarkResults) {
  if (!comparisonChart || !valueChart || !returnChart || !benchmarkResults.length) return;
  valueChart.innerHTML = "";
  returnChart.innerHTML = "";

  const valueItems = [
    { label: "Depot", value: calc.terminalValue, category: "fund" },
    ...benchmarkResults.map((item) => ({ label: item.config.shortLabel || item.config.label, value: item.benchmark.balance, category: item.kind }))
  ];
  const maxValue = Math.max(...valueItems.map((item) => item.value), 0);
  valueItems.forEach((item) => appendSimpleBar(valueChart, item.label, item.value, maxValue, item.category));

  const returnItems = [
    { label: "Depot", rate: fundXirrResult.rate, category: "fund" },
    ...benchmarkResults.map((item) => ({ label: item.config.shortLabel || item.config.label, rate: item.xirrResult.rate, category: item.kind }))
  ];
  const minRate = Math.min(...returnItems.map((item) => item.rate), 0);
  const maxRate = Math.max(...returnItems.map((item) => item.rate), 0);
  returnItems.forEach((item) => appendReturnBar(returnChart, item.label, item.rate, minRate, maxRate, item.category));

  comparisonChart.hidden = false;
}

function resetBenchmarkPresentation(calc) {
  Object.values(benchmarkCards).forEach((card) => { if (card) card.hidden = true; });
  Object.values(benchmarkNodes).forEach((group) => group.details.forEach((node) => { node.hidden = true; }));
  if (comparisonChart) comparisonChart.hidden = true;
  if (valueChart) valueChart.innerHTML = "";
  if (returnChart) returnChart.innerHTML = "";
  if (nodes.method && calc?.baseMethodText) nodes.method.textContent = calc.baseMethodText;
}

async function refreshBenchmarks(calc, xirrResult, runRevision) {
  resetBenchmarkPresentation(calc);
  const kinds = selectedBenchmarkKinds();
  if (!kinds.length) return [];

  const settled = await Promise.allSettled(kinds.map(async (kind) => {
    const { config, apiData } = await fetchBenchmarkRates(kind, calc.startDate, calc.finishDate);
    const expectedStartMonth = monthFromDate(calc.startDate);
    if (apiData.first_period > expectedStartMonth) {
      throw new Error(`ECB-Daten beginnen erst mit ${apiData.first_period}; benötigt wird ${expectedStartMonth}.`);
    }
    const effectiveTaxPercent = calc.isKestExempt ? 0 : config.taxPercent;
    const benchmark = simulateHistoricalRateBenchmark({
      cashflows: calc.benchmarkFlows,
      endDate: calc.finishDate,
      observations: apiData.observations,
      taxPercent: effectiveTaxPercent,
      seriesLabel: config.seriesLabel
    });
    return { kind, config, apiData, benchmark, effectiveTaxPercent };
  }));

  if (runRevision !== calculationRevision) return [];
  const rendered = [];
  settled.forEach((result, index) => {
    const kind = kinds[index];
    if (result.status === "fulfilled") {
      try {
        rendered.push(renderBenchmark(calc, kind, result.value.config, result.value.apiData, result.value.benchmark, result.value.effectiveTaxPercent));
      } catch (error) {
        appendWarning(`Depotrendite wurde berechnet. Effektivrendite für „${BENCHMARKS[kind]?.label || kind}“ nicht möglich: ${error.message || error}`);
      }
    } else {
      appendWarning(`Depotrendite wurde berechnet. Vergleich „${BENCHMARKS[kind]?.label || kind}“ nicht möglich: ${result.reason?.message || result.reason}`);
    }
  });
  if (rendered.length) renderComparisonCharts(calc, xirrResult, rendered);
  return rendered;
}

function formatReportDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!match) return String(iso || "–");
  return `${match[3]}.${match[2]}.${match[1]}`;
}

function selectedOptionText(select) {
  return select?.selectedOptions?.[0]?.textContent?.trim() || "–";
}

function printItem(label, value) {
  return `
    <div class="print-report__item">
      <span class="print-report__item-label">${escapeHtml(label)}</span>
      <span class="print-report__item-value">${escapeHtml(value)}</span>
    </div>
  `;
}

function buildPrintReport({ includeCashflows = true } = {}) {
  if (!printReport || !resultsNode || resultsNode.hidden) return false;

  const startAmountValue = parseGermanNumber(initialAmount?.value);
  const endAmountValue = parseGermanNumber(endValue?.value);
  const feeValue = Number(purchaseFee?.value || 0);
  const createdAt = new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
  const selectedBenchmarks = selectedBenchmarkKinds().map((kind) => BENCHMARKS[kind]?.shortLabel || kind).join(", ") || "Keine";
  const label = designation?.value?.trim() || "";

  const inputItems = [
    ["Bezeichnung", label || "–"],
    ["Kauf-/Startdatum", formatReportDate(purchaseDate?.value)],
    ["Startbetrag", Number.isFinite(startAmountValue) ? currency.format(startAmountValue) : "–"],
    ["Startbetrag ist", selectedOptionText(initialAmountMode)],
    ["Kaufspesen / Ausgabeaufschlag", `${percent.format(Number.isFinite(feeValue) ? feeValue : 0)} %`],
    ["End-/Bewertungsdatum", formatReportDate(endDate?.value)],
    ["End-/Verkaufswert", Number.isFinite(endAmountValue) ? currency.format(endAmountValue) : "–"],
    ["Benchmarks", selectedBenchmarks],
    ["KESt-Befreiungserklärung", selectedOptionText(kestExemption)]
  ];

  const flowRows = [...cashflows]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .map((flow) => `
      <tr>
        <td>${escapeHtml(formatReportDate(flow.date))}</td>
        <td>${escapeHtml(typeLabels[flow.type] || flow.type)}</td>
        <td>${escapeHtml(currency.format(flow.amount))}</td>
        <td>${escapeHtml(flow.title || "")}</td>
        <td>${escapeHtml(flow.note || "")}</td>
      </tr>
    `).join("");

  printReport.innerHTML = `
    <header class="print-report__header">
      <div class="print-report__brand">
        <img src="assets/logo/toolbox-dashboard-logo.png" alt="Toolbox">
        <div class="print-report__title">
          <h1>Depotrendite &amp; Vergleich</h1>
          <p>${escapeHtml(label || "Berechnungsbericht")}</p>
        </div>
      </div>
      <div class="print-report__meta">
        <p>Erstellt: ${escapeHtml(createdAt)}</p>
        <p>Toolbox · v${escapeHtml(SITE_VERSION)}</p>
      </div>
    </header>

    <section class="print-report__section">
      <h2>Eingaben</h2>
      <div class="print-report__input-grid">${inputItems.map(([itemLabel, value]) => printItem(itemLabel, value)).join("")}</div>
    </section>

    <section class="print-report__section">
      <h2>Weitere Zahlungsströme</h2>
      ${includeCashflows ? (flowRows ? `
        <table class="print-report__cashflows">
          <thead><tr><th>Datum</th><th>Art</th><th>Betrag</th><th>Titel</th><th>Notiz</th></tr></thead>
          <tbody>${flowRows}</tbody>
        </table>
      ` : '<p class="print-report__small">Keine weiteren Zahlungsströme erfasst.</p>') : `<p class="print-report__small">${cashflows.length} Zahlungsstrom/-ströme auf Wunsch im PDF ausgeblendet.</p>`}
    </section>
  `;

  if (savingsPlanSummary && !savingsPlanSummary.hidden) {
    const planSection = document.createElement("section");
    planSection.className = "print-report__section";
    planSection.innerHTML = "<h2>Erkannte Sparpläne</h2>";
    const clone = savingsPlanSummary.cloneNode(true);
    clone.removeAttribute("hidden");
    planSection.append(clone);
    printReport.append(planSection);
  }

  const resultSection = document.createElement("section");
  resultSection.className = "print-report__section";
  resultSection.innerHTML = "<h2>Ergebnisse</h2>";
  const resultClone = resultsNode.cloneNode(true);
  resultClone.removeAttribute("hidden");
  resultClone.removeAttribute("aria-live");
  resultSection.append(resultClone);
  printReport.append(resultSection);

  if (comparisonChart && !comparisonChart.hidden) {
    const chartSection = document.createElement("section");
    chartSection.className = "print-report__section";
    chartSection.innerHTML = "<h2>Grafischer Vergleich</h2>";
    const chartClone = comparisonChart.cloneNode(true);
    chartClone.removeAttribute("hidden");
    chartClone.removeAttribute("aria-labelledby");
    chartSection.append(chartClone);
    printReport.append(chartSection);
  }

  if (detailsNode && !detailsNode.hidden) {
    const detailSection = document.createElement("section");
    detailSection.className = "print-report__section";
    detailSection.innerHTML = "<h2>Berechnungsdetails</h2>";
    const detailsClone = detailsNode.cloneNode(true);
    detailsClone.removeAttribute("hidden");
    detailsClone.open = true;
    detailSection.append(detailsClone);
    printReport.append(detailSection);
  }

  if (warningNode && !warningNode.hidden && warningNode.textContent.trim()) {
    const warningClone = warningNode.cloneNode(true);
    warningClone.removeAttribute("hidden");
    printReport.append(warningClone);
  }

  const generalNote = document.querySelector(".fund-general-note");
  if (generalNote) printReport.append(generalNote.cloneNode(true));
  return true;
}

[initialAmount, endValue, cashflowAmount, recurringAmount].forEach((input) => {
  input?.addEventListener("blur", () => formatAmountInput(input));
});

function handleFormMutation(event) {
  if (event.target?.matches?.("[data-benchmark-checkbox]")) return;
  clearCalculation();
}
form?.addEventListener("input", handleFormMutation);
form?.addEventListener("change", handleFormMutation);

cashflowBody?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-cashflow]");
  if (!button) return;
  const id = Number(button.dataset.deleteCashflow);
  cashflows = cashflows.filter((flow) => flow.id !== id);
  renderCashflows();
  clearCalculation();
});

cashflowBody?.addEventListener("change", (event) => {
  const input = event.target.closest("[data-flow-field]");
  const row = event.target.closest("[data-cashflow-id]");
  if (!input || !row) return;
  const flow = cashflows.find((item) => item.id === Number(row.dataset.cashflowId));
  if (!flow) return;

  try {
    const field = input.dataset.flowField;
    if (field === "date") {
      if (!input.value) throw new Error("Datum darf nicht leer sein.");
      flow.date = input.value;
    } else if (field === "type") {
      flow.type = input.value;
    } else if (field === "amount") {
      const value = parseGermanNumber(input.value);
      if (!Number.isFinite(value) || value === 0) throw new Error("Betrag muss ungleich 0 sein.");
      flow.amount = value;
      input.value = formatGermanNumber(value);
    } else if (field === "title") {
      flow.title = input.value.trim();
    } else if (field === "note") {
      flow.note = input.value.trim();
    }
    clearCalculation();
  } catch (error) {
    showError(error.message || "Zahlungsstrom konnte nicht geändert werden.");
    renderCashflows();
  }
});

document.querySelector("[data-add-cashflow]")?.addEventListener("click", () => {
  try {
    addCashflow({
      date: cashflowDate.value,
      type: cashflowType.value,
      amount: cashflowAmount.value,
      title: cashflowTitle.value,
      note: cashflowNote.value
    });
    cashflowAmount.value = "";
    cashflowTitle.value = "";
    cashflowNote.value = "";
  } catch (error) {
    showError(error.message || "Zahlungsstrom konnte nicht hinzugefügt werden.");
  }
});

document.querySelector("[data-add-recurring]")?.addEventListener("click", () => {
  try {
    const dates = generateRecurringDates({
      firstDate: recurringFirst.value,
      lastDate: recurringLast.value,
      intervalMonths: Number(recurringInterval.value)
    });
    const signedAmount = normalizeSignedAmount(recurringAmount.value, recurringType.value);
    for (const date of dates) {
      cashflows.push({
        id: nextCashflowId++,
        date,
        type: recurringType.value,
        amount: signedAmount,
        title: recurringTitle.value.trim(),
        note: recurringNote.value.trim()
      });
    }
    renderCashflows();
    clearCalculation();
    recurringAmount.value = formatGermanNumber(signedAmount);
  } catch (error) {
    showError(error.message || "Regelmäßige Zahlungen konnten nicht erzeugt werden.");
  }
});



csvImportButton?.addEventListener("click", () => {
  csvImportFileInput?.click();
});

csvImportFileInput?.addEventListener("change", async () => {
  const file = csvImportFileInput.files?.[0];
  csvImportFileInput.value = "";
  if (!file) return;
  clearCalculation();
  try {
    await importBankTransactionsCsv(file);
  } catch (error) {
    showError(error.message || "CSV-Daten konnten nicht importiert werden.");
  }
});

exportButton?.addEventListener("click", async () => {
  try {
    const data = currentFundData();
    const result = await saveJsonFile(data);
    if (result.cancelled) return;
    const flowLabel = data.cashflows.length === 1 ? "1 zusätzlicher Zahlungsstrom" : `${data.cashflows.length} zusätzliche Zahlungsströme`;
    const locationNote = result.picker ? " Speicherort wurde ausgewählt." : " Browser-Download verwendet.";
    showDataStatus(`Berechnungsdaten exportiert (${flowLabel}).${locationNote}`);
  } catch (error) {
    showError(error.message || "Daten konnten nicht exportiert werden.");
  }
});

importButton?.addEventListener("click", () => {
  importFileInput?.click();
});

importFileInput?.addEventListener("change", async () => {
  const file = importFileInput.files?.[0];
  importFileInput.value = "";
  if (!file) return;
  clearCalculation();
  try {
    if (file.size > 2_000_000) throw new Error("Die Importdatei ist zu groß.");
    const payload = JSON.parse(await file.text());
    applyImportedFundData(payload);
  } catch (error) {
    showError(error instanceof SyntaxError ? "Die JSON-Datei ist ungültig." : (error.message || "Daten konnten nicht importiert werden."));
  }
});

function closePrintOptions() {
  if (printOptions) printOptions.hidden = true;
}

printButton?.addEventListener("click", () => {
  if (!printOptions) return;
  if (printCashflows) {
    printCashflows.checked = false;
    printCashflows.disabled = cashflows.length === 0;
  }
  printOptions.hidden = false;
  printConfirmButton?.focus();
});

printCancelButton?.addEventListener("click", closePrintOptions);
printOptions?.addEventListener("click", (event) => {
  if (event.target === printOptions) closePrintOptions();
});

printConfirmButton?.addEventListener("click", () => {
  const includeCashflows = cashflows.length ? Boolean(printCashflows?.checked) : true;
  if (!buildPrintReport({ includeCashflows })) return;
  const previousTitle = document.title;
  const suffix = endDate?.value ? `_${endDate.value}` : "";
  const name = safeFilenamePart(designation?.value);
  document.title = `Toolbox_Depotrendite${name ? `_${name}` : ""}${suffix}`;
  closePrintOptions();

  const restoreTitle = () => { document.title = previousTitle; };
  window.addEventListener("afterprint", restoreTitle, { once: true });
  window.print();
  window.setTimeout(restoreTitle, 1500);
});

resetButton?.addEventListener("click", () => {
  form?.reset();
  cashflows = [];
  nextCashflowId = 1;
  renderCashflows();
  syncEnhancedDateInputs();
  closePrintOptions();
  clearCalculation();
  const purchaseText = enhancedDateInputs.get(purchaseDate);
  (purchaseText || purchaseDate)?.focus();
});

benchmarkCheckboxes.forEach((box) => {
  box.addEventListener("change", async () => {
    if (!lastCoreCalculation) return;
    calculationRevision += 1;
    const runRevision = calculationRevision;
    if (warningNode) { warningNode.hidden = true; warningNode.textContent = ""; }
    const { calc, xirrResult } = lastCoreCalculation;
    renderCoreResults(calc, xirrResult);
    renderSavingsPlanSummary(calc.enteredIntermediate);
    await refreshBenchmarks(calc, xirrResult, runRevision);
    if (runRevision === calculationRevision && printButton) printButton.hidden = false;
  });
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearCalculation();
  const runRevision = calculationRevision;
  formatAmountInput(initialAmount);
  formatAmountInput(endValue);

  try {
    const calc = buildCalculation();
    const xirrResult = calculateXirr(calc.investorFlows);
    renderCoreResults(calc, xirrResult);
    renderSavingsPlanSummary(calc.enteredIntermediate);
    lastCoreCalculation = { calc, xirrResult };

    window.requestAnimationFrame(() => {
      resultsNode?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
    });

    await refreshBenchmarks(calc, xirrResult, runRevision);
    if (runRevision !== calculationRevision) return;
    if (printButton) printButton.hidden = false;
  } catch (error) {
    showError(error.message || "Berechnung nicht möglich.");
  }
});

enhanceDateInputs(document);
renderCashflows();

form?.addEventListener("reset", () => {
  window.setTimeout(syncEnhancedDateInputs, 0);
});
