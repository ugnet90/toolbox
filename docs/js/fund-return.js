import { SITE_VERSION } from "./site-map.js";
import {
  applyKestExemption,
  calculateXirr,
  createFundReturnData,
  detectRecurringSavingsPlans,
  formatGermanNumber,
  generateRecurringDates,
  initialInvestment,
  mergeDateRanges,
  missingDateRanges,
  buildDepotHistory,
  buildBenchmarkHistory,
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
const printCashflowsMode = document.querySelector("[data-print-cashflows-mode]");
const printCashflowsHint = document.querySelector("[data-print-cashflows-hint]");
const printHistoryCharts = document.querySelector("[data-print-history-charts]");
const printHistoryChartsHint = document.querySelector("[data-print-history-charts-hint]");
const pdfConfirmButton = document.querySelector("[data-pdf-confirm]");
const printConfirmButton = document.querySelector("[data-print-confirm]");
const printCancelButton = document.querySelector("[data-print-cancel]");
const printStatus = document.querySelector("[data-print-status]");
const importButton = document.querySelector("[data-import-fund]");
const exportButton = document.querySelector("[data-export-fund]");
const importFileInput = document.querySelector("[data-import-fund-file]");
const csvImportButton = document.querySelector("[data-import-bank-csv]");
const csvImportFileInput = document.querySelector("[data-import-bank-csv-file]");
const csvImportDialog = document.querySelector("[data-csv-import-dialog]");
const csvImportDialogTitle = document.querySelector("[data-csv-import-dialog-title]");
const csvImportDialogQuestion = document.querySelector("[data-csv-import-dialog-question]");
const csvImportDialogYes = document.querySelector("[data-csv-import-dialog-yes]");
const csvImportDialogNo = document.querySelector("[data-csv-import-dialog-no]");
const dataStatusNode = document.querySelector("[data-fund-data-status]");
const savingsPlanSummary = document.querySelector("[data-savings-plan-summary]");
const savingsPlanList = document.querySelector("[data-savings-plan-list]");
const benchmarkCheckboxes = [...document.querySelectorAll("[data-benchmark-checkbox]")];
const depotHistory = document.querySelector("[data-depot-history]");
const depotHistoryStatus = document.querySelector("[data-depot-history-status]");
const depotHistoryChart = document.querySelector("[data-depot-history-chart]");
const depotReturnChart = document.querySelector("[data-depot-return-chart]");
const historySeriesPicker = document.querySelector("[data-history-series-picker]");
const historyValueLegend = document.querySelector("[data-history-value-legend]");
const historyReturnLegend = document.querySelector("[data-history-return-legend]");
const historyValueBlock = document.querySelector("[data-history-value-block]");
const historyReturnBlock = document.querySelector("[data-history-return-block]");
const depotHistoryPeriod = document.querySelector("[data-depot-history-period]");
const depotHistoryValue = document.querySelector("[data-depot-history-value]");
const depotHistoryInvested = document.querySelector("[data-depot-history-invested]");
const depotHistoryFunds = document.querySelector("[data-depot-history-funds]");
const useHistoryEndValueButton = document.querySelector("[data-use-history-end-value]");

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
const cashflowIsin = document.querySelector("#cashflowIsin");
const cashflowQuantity = document.querySelector("#cashflowQuantity");
const cashflowNote = document.querySelector("#cashflowNote");

const recurringType = document.querySelector("#recurringType");
const recurringAmount = document.querySelector("#recurringAmount");
const recurringAmountMode = document.querySelector("#recurringAmountMode");
const recurringPurchaseFee = document.querySelector("#recurringPurchaseFee");
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
let lastBenchmarkResults = [];
let lastDepotHistory = null;
const historySeriesSelection = new Map();
let csvImportSessionActive = false;
let csvImportSessionEarliestDate = null;
let csvImportAwaitingAdditionalFile = false;
let csvImportDialogStep = null;
const memoryPriceCache = new Map();

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
  lastBenchmarkResults = [];
  lastDepotHistory = null;
  if (depotHistory) depotHistory.hidden = true;
  if (depotHistoryChart) depotHistoryChart.innerHTML = "";
  if (depotReturnChart) depotReturnChart.innerHTML = "";
  if (historySeriesPicker) historySeriesPicker.innerHTML = "";
  if (historyValueLegend) historyValueLegend.innerHTML = "";
  if (historyReturnLegend) historyReturnLegend.innerHTML = "";
  if (depotHistoryStatus) { depotHistoryStatus.hidden = true; depotHistoryStatus.textContent = ""; }
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
      recurringPurchaseFeePercent: Number(recurringPurchaseFee?.value || 0),
      recurringAmountMode: recurringAmountMode?.value || "gross",
      endDate: endDate?.value,
      endValue: terminal,
      benchmarkKinds: selectedBenchmarkKinds(),
      kestExemption: kestExemption?.value
    },
    cashflows: cashflows.map(({ date, type, amount, title, note, isin, quantity, unit }) => ({
      date, type, amount, title: title || "", note: note || "", isin: isin || "",
      quantity: Number.isFinite(Number(quantity)) ? Number(quantity) : null, unit: unit || ""
    }))
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
  if (recurringPurchaseFee) recurringPurchaseFee.value = String(normalized.inputs.recurringPurchaseFeePercent ?? 0);
  if (recurringAmountMode) recurringAmountMode.value = normalized.inputs.recurringAmountMode || "gross";
  syncRecurringFeeControls();
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
  showDataStatus(`${label} aus CSV importiert${hadExisting ? " und zu den bestehenden Zahlungsströmen hinzugefügt" : ""}.${skipped}`);
  if (parsed.unknownBusinessTypes > 0) {
    appendWarning(`${parsed.unknownBusinessTypes} unbekannte Geschäftsart(en) wurden als „Sonstiger Cashflow“ übernommen; Originaltext steht in der Notiz.`);
  }
  if (parsed.normalizedOutflowSigns > 0) {
    appendWarning(`${parsed.normalizedOutflowSigns} als Belastung erkannte positive Buchungsbeträge wurden automatisch mit negativem Vorzeichen übernommen.`);
  }
  if (!parsed.hasTitleColumn) {
    appendWarning("Die CSV-Datei enthält keine Spalte „Titel“. Eine fondsbezogene Sparplan-Erkennung ist daher für diese Buchungen nicht möglich.");
  }
  if (!parsed.hasIsinColumn || !parsed.hasQuantityColumn) {
    appendWarning("Für die historische Depotwert-Grafik werden zusätzlich die CSV-Spalten „ISIN“ und „Menge“ benötigt.");
  } else if (parsed.securityIsins.length) {
    showDataStatus(`${label} aus CSV importiert${hadExisting ? " und zu den bestehenden Zahlungsströmen hinzugefügt" : ""}.${skipped} ${parsed.securityIsins.length} Wertpapier-ISIN(s) mit Stückbewegungen erkannt.`);
  }
  if (parsed.normalizedQuantitySigns > 0) {
    appendWarning(`${parsed.normalizedQuantitySigns} Mengenangabe(n) wurden für Kauf/Verkauf auf das passende Vorzeichen normalisiert.`);
  }
  return parsed;
}

function beginCsvImportSession() {
  if (!csvImportSessionActive) {
    csvImportSessionActive = true;
    csvImportSessionEarliestDate = null;
  }
}

function rememberCsvImportDate(date) {
  if (!date) return;
  if (!csvImportSessionEarliestDate || date < csvImportSessionEarliestDate) {
    csvImportSessionEarliestDate = date;
  }
}

function applyCsvZeroStart() {
  if (!csvImportSessionEarliestDate) {
    appendWarning("Aus den importierten CSV-Dateien konnte kein Startdatum ermittelt werden. Bitte Startdatum und Startwert manuell eingeben.");
    const purchaseText = enhancedDateInputs.get(purchaseDate);
    (purchaseText || purchaseDate)?.focus();
    return false;
  }

  purchaseDate.value = csvImportSessionEarliestDate;
  initialAmount.value = formatGermanNumber(0);
  initialAmountMode.value = "gross";
  purchaseFee.value = "0";
  syncEnhancedDateInputs();
  clearCalculation();
  showDataStatus(`CSV-Import abgeschlossen. Depotstart automatisch auf ${formatReportDate(csvImportSessionEarliestDate)} mit Startwert ${currency.format(0)} gesetzt.`);
  return true;
}

function closeCsvImportDialog() {
  if (csvImportDialog) csvImportDialog.hidden = true;
  csvImportDialogStep = null;
}

function endCsvImportSession() {
  closeCsvImportDialog();
  csvImportSessionActive = false;
  csvImportSessionEarliestDate = null;
  csvImportAwaitingAdditionalFile = false;
}

function openCsvImportQuestion(step) {
  csvImportDialogStep = step;
  if (csvImportDialogTitle) {
    csvImportDialogTitle.textContent = step === "more" ? "CSV-Import" : "Depotstart";
  }
  if (csvImportDialogQuestion) {
    csvImportDialogQuestion.textContent = step === "more"
      ? "Möchten Sie eine weitere CSV-Datei importieren?"
      : "Möchten Sie Startdatum und -wert eingeben?";
  }
  if (csvImportDialog) csvImportDialog.hidden = false;
  csvImportDialogYes?.focus();
}

function finishCsvImportSession() {
  openCsvImportQuestion("more");
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
      <td><input class="table-input table-input--isin" type="text" maxlength="12" value="${escapeHtml(flow.isin || "")}" data-flow-field="isin" aria-label="ISIN"></td>
      <td><input class="table-input table-input--quantity" type="text" inputmode="decimal" value="${flow.quantity === null || flow.quantity === undefined ? "" : formatGermanNumber(flow.quantity, 6).replace(/0+$/, "").replace(/,$/, "")}" data-flow-field="quantity" aria-label="Menge"></td>
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

function addCashflow({ date, type, amount, title = "", isin = "", quantity = "", note = "" }) {
  if (!date) throw new Error("Bitte ein Datum für den Zahlungsstrom eingeben.");
  const signedAmount = normalizeSignedAmount(amount, type);
  const normalizedIsin = String(isin || "").trim().toUpperCase();
  if (normalizedIsin && !/^[A-Z]{2}[A-Z0-9]{10}$/.test(normalizedIsin)) throw new Error("Die ISIN ist ungültig.");
  let normalizedQuantity = quantity === "" || quantity === null || quantity === undefined ? null : parseGermanNumber(quantity);
  if (normalizedQuantity !== null && !Number.isFinite(normalizedQuantity)) throw new Error("Die Menge ist ungültig.");
  if (normalizedQuantity === 0) normalizedQuantity = null;
  if (normalizedQuantity !== null && type === "contribution") normalizedQuantity = Math.abs(normalizedQuantity);
  if (normalizedQuantity !== null && type === "withdrawal") normalizedQuantity = -Math.abs(normalizedQuantity);
  cashflows.push({ id: nextCashflowId++, date, type, amount: signedAmount, title: title.trim(), note: note.trim(), isin: normalizedIsin, quantity: normalizedQuantity, unit: normalizedQuantity === null ? "" : "Stk" });
  renderCashflows();
  clearCalculation();
}

function monthFromDate(iso) {
  return String(iso).slice(0, 7);
}


const PRICE_DB_NAME = "toolbox-depot-price-cache";
const PRICE_DB_VERSION = 1;
const PRICE_STORE = "funds";
const LOCAL_PRICE_REFRESH_MS = 20 * 60 * 60 * 1000;

function openPriceDb() {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(PRICE_DB_NAME, PRICE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PRICE_STORE)) db.createObjectStore(PRICE_STORE, { keyPath: "isin" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function getPriceCacheRecord(isin) {
  const memory = memoryPriceCache.get(isin);
  const db = await openPriceDb();
  if (!db) return memory || null;
  return new Promise((resolve) => {
    const tx = db.transaction(PRICE_STORE, "readonly");
    const request = tx.objectStore(PRICE_STORE).get(isin);
    request.onsuccess = () => resolve(request.result || memory || null);
    request.onerror = () => resolve(memory || null);
    tx.oncomplete = () => db.close();
  });
}

async function putPriceCacheRecord(record) {
  memoryPriceCache.set(record.isin, record);
  const db = await openPriceDb();
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction(PRICE_STORE, "readwrite");
    tx.objectStore(PRICE_STORE).put(record);
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
  db.close();
}

function isoDaysAgo(days) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function dateMax(a, b) { return a > b ? a : b; }

async function fetchUnionPriceRange(isin, start, end) {
  const url = new URL(`${DATA_PROXY}/union-prices`);
  url.searchParams.set("isin", isin);
  url.searchParams.set("start", start);
  url.searchParams.set("end", end);
  const response = await fetch(url.toString(), { headers: { Accept: "application/json" }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `${isin}: Union-Kursdaten konnten nicht geladen werden.`);
  return payload;
}

async function ensureUnionPriceRange(isin, start, end) {
  let record = await getPriceCacheRecord(isin) || {
    isin,
    currency: null,
    prices: {},
    coveredRanges: [],
    updatedAt: null,
    sourceCreationDate: null
  };
  const missing = missingDateRanges(start, end, record.coveredRanges || []);
  const updatedMs = record.updatedAt ? Date.parse(record.updatedAt) : NaN;
  const recentTailNeedsRefresh = end >= isoDaysAgo(14) && (!Number.isFinite(updatedMs) || Date.now() - updatedMs > LOCAL_PRICE_REFRESH_MS);
  if (recentTailNeedsRefresh) {
    const tail = { start: dateMax(start, isoDaysAgo(14)), end };
    if (!missing.some((range) => range.start <= tail.start && range.end >= tail.end)) missing.push(tail);
  }

  for (const range of mergeDateRanges(missing)) {
    const payload = await fetchUnionPriceRange(isin, range.start, range.end);
    for (const obs of payload.observations || []) {
      const price = Number(obs.redemption_price);
      if (obs.date && Number.isFinite(price)) record.prices[obs.date] = price;
    }
    if (payload.previous_observation?.date && Number.isFinite(Number(payload.previous_observation.redemption_price))) {
      record.prices[payload.previous_observation.date] = Number(payload.previous_observation.redemption_price);
    }
    record.currency = payload.fund?.currency || record.currency || "EUR";
    record.sourceCreationDate = payload.creation_date || record.sourceCreationDate;
    record.updatedAt = new Date().toISOString();
    record.coveredRanges = mergeDateRanges([...(record.coveredRanges || []), range]);
  }
  await putPriceCacheRecord(record);
  const observations = Object.entries(record.prices || {}).map(([date, redemption_price]) => ({ date, redemption_price }))
    .filter((item) => item.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
  return { currency: record.currency || "EUR", observations, updatedAt: record.updatedAt };
}

function securityFlowsForHistory() {
  return cashflows.filter((flow) => flow.isin && Number.isFinite(Number(flow.quantity)) && Number(flow.quantity) !== 0 && ["contribution", "withdrawal"].includes(flow.type));
}

function setDepotHistoryStatus(message, isError = false) {
  if (!depotHistoryStatus) return;
  depotHistoryStatus.textContent = message;
  depotHistoryStatus.hidden = false;
  depotHistoryStatus.classList.toggle("depot-history__status--error", isError);
}

function svgText(value) {
  return escapeHtml(String(value));
}

const HISTORY_COLORS = {
  depotValue: "#316880",
  netInvested: "#a67523",
  profit: "#5f7d4f",
  depotReturn: "#1c728f",
  overnight: "#d8ad57",
  euribor3m: "#c88a32",
  euribor6m: "#b56b28",
  euribor12m: "#914c22"
};
const HISTORY_FUND_COLORS = ["#4f7391", "#5c8068", "#765f8d", "#9a6b4a", "#4f7f82", "#7b7049", "#6877a0", "#8a5f72"];
const chartCurrency = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const chartPercent = new Intl.NumberFormat("de-AT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function historySeriesIsSelected(key, defaultValue = false) {
  if (!historySeriesSelection.has(key)) historySeriesSelection.set(key, defaultValue);
  return historySeriesSelection.get(key) === true;
}

function historyFundColor(index) {
  return HISTORY_FUND_COLORS[index % HISTORY_FUND_COLORS.length];
}

function historySeriesDefinitions(history) {
  const valueSeries = [
    {
      key: "value:depot",
      label: "Depotwert",
      color: HISTORY_COLORS.depotValue,
      defaultSelected: true,
      points: (history.points || []).map((point) => ({ date: point.date, value: point.depotValue }))
    },
    {
      key: "value:invested",
      label: "Kumulierte Nettoinvestitionen",
      color: HISTORY_COLORS.netInvested,
      defaultSelected: true,
      points: (history.points || []).map((point) => ({ date: point.date, value: point.netInvested }))
    },
    {
      key: "value:profit",
      label: "Gewinn / Verlust",
      color: HISTORY_COLORS.profit,
      defaultSelected: true,
      points: (history.points || []).map((point) => ({ date: point.date, value: point.profit }))
    }
  ];

  const returnSeries = [
    {
      key: "return:depot",
      label: "Depotrendite",
      color: HISTORY_COLORS.depotReturn,
      defaultSelected: true,
      points: (history.points || []).map((point) => ({ date: point.date, value: point.depotReturn }))
    }
  ];

  (history.funds || []).forEach((fund, index) => {
    returnSeries.push({
      key: `return:fund:${fund.isin}`,
      label: fund.title && fund.title !== fund.isin ? fund.title : fund.isin,
      detail: fund.isin,
      color: historyFundColor(index),
      defaultSelected: false,
      points: (history.points || []).map((point) => ({ date: point.date, value: point.fundReturns?.[fund.isin] }))
    });
  });

  for (const [kind, points] of Object.entries(history.benchmarkSeries || {})) {
    const config = BENCHMARKS[kind];
    if (!config) continue;
    valueSeries.push({
      key: `value:benchmark:${kind}`,
      label: `${config.shortLabel || config.label} – Wert`,
      color: HISTORY_COLORS[kind] || "#a67523",
      defaultSelected: false,
      points: points.map((point) => ({ date: point.date, value: point.value }))
    });
    returnSeries.push({
      key: `return:benchmark:${kind}`,
      label: `${config.shortLabel || config.label} – Rendite`,
      color: HISTORY_COLORS[kind] || "#a67523",
      defaultSelected: false,
      points: points.map((point) => ({ date: point.date, value: point.rate }))
    });
  }
  return { valueSeries, returnSeries };
}

function createHistorySeriesCheck(series, groupLabel) {
  const label = document.createElement("label");
  label.className = "depot-history__series-check";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.historySeriesKey = series.key;
  input.checked = historySeriesIsSelected(series.key, series.defaultSelected);
  const swatch = document.createElement("i");
  swatch.className = "depot-history__series-swatch";
  swatch.style.background = series.color;
  const text = document.createElement("span");
  text.textContent = series.label;
  if (series.detail) text.title = series.detail;
  label.append(input, swatch, text);
  label.dataset.historySeriesGroup = groupLabel;
  return label;
}

function renderHistorySeriesPicker(history) {
  if (!historySeriesPicker) return;
  const { valueSeries, returnSeries } = historySeriesDefinitions(history);
  historySeriesPicker.innerHTML = "";

  const groups = [
    ["Wertentwicklung", valueSeries],
    ["Renditen", returnSeries]
  ];
  for (const [title, seriesList] of groups) {
    const group = document.createElement("div");
    group.className = "depot-history__series-group";
    const heading = document.createElement("strong");
    heading.textContent = title;
    group.append(heading);
    const checks = document.createElement("div");
    checks.className = "depot-history__series-checks";
    seriesList.forEach((series) => checks.append(createHistorySeriesCheck(series, title)));
    group.append(checks);
    historySeriesPicker.append(group);
  }
}

function historyPath(points, x, y) {
  let d = "";
  let penDown = false;
  for (const point of points) {
    const value = Number(point.value);
    if (!Number.isFinite(value)) {
      penDown = false;
      continue;
    }
    d += `${penDown ? "L" : "M"}${x(point.date).toFixed(2)},${y(value).toFixed(2)} `;
    penDown = true;
  }
  return d.trim();
}

function setHistoryLegend(node, series) {
  if (!node) return;
  node.innerHTML = "";
  for (const item of series) {
    const entry = document.createElement("span");
    const key = document.createElement("i");
    key.className = "depot-history__key";
    key.style.background = item.color;
    const text = document.createElement("span");
    text.textContent = item.label;
    entry.append(key, text);
    node.append(entry);
  }
}

function renderHistoryLineChart(container, series, { ariaLabel, formatter }) {
  if (!container) return false;
  const visible = series.filter((item) => historySeriesIsSelected(item.key, item.defaultSelected));
  const finitePoints = visible.flatMap((item) => item.points.filter((point) => Number.isFinite(Number(point.value))));
  if (!visible.length || !finitePoints.length) {
    container.innerHTML = '<p class="depot-history__empty-chart">Keine Diagrammlinie mit verfügbaren Daten ausgewählt.</p>';
    return false;
  }

  const width = 1000;
  const height = 350;
  const left = 78, right = 46, top = 24, bottom = 52;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const dates = finitePoints.map((point) => point.date).sort();
  const startDate = dates[0];
  const endDateValue = dates[dates.length - 1];
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDateValue}T00:00:00Z`);
  const values = finitePoints.map((point) => Number(point.value));
  let minY = Math.min(...values, 0);
  let maxY = Math.max(...values, 0);
  if (Math.abs(maxY - minY) < 1e-12) {
    const pad = Math.max(Math.abs(maxY) * 0.1, 1);
    minY -= pad;
    maxY += pad;
  }
  const spanY = maxY - minY;
  const x = (date) => left + ((Date.parse(`${date}T00:00:00Z`) - startMs) / Math.max(endMs - startMs, 1)) * plotW;
  const y = (value) => top + (1 - ((value - minY) / spanY)) * plotH;
  const yTicks = Array.from({ length: 5 }, (_, index) => minY + (spanY * index) / 4);
  const sampleDates = [startDate];
  const allDates = [...new Set(finitePoints.map((point) => point.date))].sort();
  if (allDates.length > 2) {
    sampleDates.push(allDates[Math.round((allDates.length - 1) / 3)], allDates[Math.round((allDates.length - 1) * 2 / 3)]);
  }
  if (endDateValue !== startDate) sampleDates.push(endDateValue);
  const xTicks = [...new Set(sampleDates)];
  const formatDate = (iso) => new Intl.DateTimeFormat("de-AT", { month: "2-digit", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`));
  const lineMarkup = visible.map((item) => {
    const d = historyPath(item.points, x, y);
    return d ? `<path class="depot-history__line" style="stroke:${item.color}" d="${d}"></path>` : "";
  }).join("");
  container.innerHTML = `
    <svg class="depot-history__svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${svgText(ariaLabel)}">
      ${yTicks.map((tick) => `<line class="depot-history__grid" x1="${left}" x2="${width-right}" y1="${y(tick)}" y2="${y(tick)}"></line><text class="depot-history__axis-label" x="${left-8}" y="${y(tick)+4}" text-anchor="end">${svgText(formatter(tick))}</text>`).join("")}
      <line class="depot-history__axis" x1="${left}" x2="${left}" y1="${top}" y2="${height-bottom}"></line>
      <line class="depot-history__axis" x1="${left}" x2="${width-right}" y1="${height-bottom}" y2="${height-bottom}"></line>
      ${xTicks.map((date, index) => {
        const anchor = index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle";
        return `<text class="depot-history__axis-label" x="${x(date)}" y="${height-bottom+27}" text-anchor="${anchor}">${svgText(formatDate(date))}</text>`;
      }).join("")}
      ${lineMarkup}
    </svg>`;
  return true;
}

function renderDepotHistoryCharts(history) {
  const { valueSeries, returnSeries } = historySeriesDefinitions(history);
  const selectedValues = valueSeries.filter((item) => historySeriesIsSelected(item.key, item.defaultSelected));
  const selectedReturns = returnSeries.filter((item) => historySeriesIsSelected(item.key, item.defaultSelected));
  setHistoryLegend(historyValueLegend, selectedValues);
  setHistoryLegend(historyReturnLegend, selectedReturns);
  const valueRendered = renderHistoryLineChart(depotHistoryChart, valueSeries, {
    ariaLabel: "Historische Depotwertentwicklung",
    formatter: (value) => chartCurrency.format(value)
  });
  const returnRendered = renderHistoryLineChart(depotReturnChart, returnSeries, {
    ariaLabel: "Historische Depot- und Fondsrenditen",
    formatter: (value) => `${chartPercent.format(value * 100)} %`
  });
  if (historyValueBlock) historyValueBlock.hidden = !valueRendered;
  if (historyReturnBlock) historyReturnBlock.hidden = !returnRendered;
}

function renderDepotHistory(history) {
  lastDepotHistory = history;
  if (!depotHistory) return;
  depotHistory.hidden = false;
  if (depotHistoryStatus) depotHistoryStatus.hidden = true;
  setText(depotHistoryPeriod, `${formatReportDate(history.startDate)} – ${formatReportDate(history.endDate)}`);
  setText(depotHistoryValue, currency.format(history.lastValue));
  setText(depotHistoryInvested, currency.format(history.lastNetInvested));
  setText(depotHistoryFunds, `${history.isins.length} Fonds / ${history.holdings.length} aktuelle Position(en)`);
  renderHistorySeriesPicker(history);
  renderDepotHistoryCharts(history);
}

function buildHistoryContext() {
  const finishDate = endDate?.value;
  if (!finishDate) throw new Error("Bitte End-/Bewertungsdatum eingeben.");

  const securityFlows = securityFlowsForHistory();
  if (!securityFlows.length) {
    throw new Error("Für die Depotwertermittlung werden Kauf-/Verkaufsbuchungen mit ISIN und Menge benötigt.");
  }
  const earliestSecurityDate = securityFlows.map((flow) => flow.date).sort()[0];
  const startDate = purchaseDate?.value || earliestSecurityDate;
  if (finishDate < earliestSecurityDate) {
    throw new Error("Das End-/Bewertungsdatum liegt vor der ersten Wertpapierbewegung.");
  }

  const enteredIntermediate = [...cashflows].sort((a, b) => a.date.localeCompare(b.date));
  if (startDate && enteredIntermediate.some((flow) => flow.date < startDate || flow.date > finishDate)) {
    throw new Error("Alle Zahlungsströme müssen zwischen Start- und Enddatum liegen.");
  }

  let startOutflow = 0;
  const initialText = initialAmount?.value?.trim() || "";
  if (initialText) {
    const amount = parseGermanNumber(initialText);
    if (!Number.isFinite(amount) || amount < 0) throw new Error("Der Startbetrag muss mindestens 0 sein.");
    if (!purchaseDate?.value && amount !== 0) {
      throw new Error("Bitte für einen Startbetrag ungleich 0 auch das Kauf-/Startdatum eingeben.");
    }
    startOutflow = initialInvestment({
      amount,
      amountMode: initialAmountMode?.value || "gross",
      purchaseFeePercent: Number(purchaseFee?.value || 0)
    }).customerOutflow;
  }

  const isKestExempt = kestExemption?.value === "yes";
  const intermediate = applyKestExemption(enteredIntermediate, isKestExempt).cashflows;
  const benchmarkFlows = [];
  if (startDate) benchmarkFlows.push({ date: startDate, amount: -startOutflow, type: "start", note: "Startinvestition" });
  benchmarkFlows.push(...intermediate.map((flow) => ({ ...flow })));
  return { finishDate, benchmarkFlows };
}

async function refreshDepotHistory(calc) {
  const flows = securityFlowsForHistory();
  if (!flows.length) {
    if (depotHistory) depotHistory.hidden = true;
    return null;
  }
  const start = flows.map((flow) => flow.date).sort()[0];
  const isins = [...new Set(flows.map((flow) => flow.isin))].sort();
  if (depotHistory) depotHistory.hidden = false;
  setDepotHistoryStatus(`Historische Rücknahmepreise für ${isins.length} ISIN(s) werden geladen …`);
  const pricePairs = await Promise.all(isins.map(async (isin) => [isin, await ensureUnionPriceRange(isin, start, calc.finishDate)]));
  const pricesByIsin = Object.fromEntries(pricePairs);
  const history = buildDepotHistory({
    cashflows,
    pricesByIsin,
    endDate: calc.finishDate,
    maxPoints: 520,
    returnCashflows: calc.benchmarkFlows
  });
  renderDepotHistory(history);
  return history;
}

function enrichDepotHistoryWithBenchmarks(calc, benchmarkResults) {
  if (!lastDepotHistory) return;
  const benchmarkSeries = {};
  for (const item of benchmarkResults || []) {
    benchmarkSeries[item.kind] = buildBenchmarkHistory({
      historyPoints: lastDepotHistory.points,
      cashflows: calc.benchmarkFlows,
      observations: item.apiData.observations,
      taxPercent: item.effectiveTaxPercent,
      seriesLabel: item.config.seriesLabel
    });
  }
  lastDepotHistory.benchmarkSeries = benchmarkSeries;
  renderDepotHistory(lastDepotHistory);
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

function buildPrintReport({ includeCashflows = true, includeHistoryCharts = false } = {}) {
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
    ["Kaufspesen Start-/Einmalanlage", `${percent.format(Number.isFinite(feeValue) ? feeValue : 0)} %`],
    ["Kaufspesen Sparrate/Dauerauftrag", `${percent.format(Number(recurringPurchaseFee?.value || 0))} %`],
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

  if (includeHistoryCharts && depotHistory && !depotHistory.hidden && lastDepotHistory) {
    const historySection = document.createElement("section");
    historySection.className = "print-report__section";
    historySection.innerHTML = "<h2>Historische Depotentwicklung</h2>";
    const historyClone = depotHistory.cloneNode(true);
    historyClone.removeAttribute("hidden");
    historyClone.removeAttribute("aria-labelledby");
    historyClone.querySelector(".depot-history__series-picker")?.remove();
    historyClone.querySelector(".depot-history__actions")?.remove();
    historyClone.querySelectorAll(":scope > .field__hint").forEach((node) => node.remove());
    historySection.append(historyClone);
    printReport.append(historySection);
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

historySeriesPicker?.addEventListener("change", (event) => {
  const input = event.target.closest?.("[data-history-series-key]");
  if (!input || !lastDepotHistory) return;
  historySeriesSelection.set(input.dataset.historySeriesKey, input.checked);
  renderDepotHistoryCharts(lastDepotHistory);
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
    } else if (field === "isin") {
      const value = input.value.trim().toUpperCase();
      if (value && !/^[A-Z]{2}[A-Z0-9]{10}$/.test(value)) throw new Error("ISIN ist ungültig.");
      flow.isin = value;
      input.value = value;
    } else if (field === "quantity") {
      const raw = input.value.trim();
      if (!raw) {
        flow.quantity = null;
      } else {
        const value = parseGermanNumber(raw);
        if (!Number.isFinite(value)) throw new Error("Menge ist ungültig.");
        flow.quantity = value === 0 ? null : value;
        input.value = flow.quantity === null ? "" : formatGermanNumber(flow.quantity, 6).replace(/0+$/, "").replace(/,$/, "");
      }
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
      isin: cashflowIsin?.value || "",
      quantity: cashflowQuantity?.value || "",
      note: cashflowNote.value
    });
    cashflowAmount.value = "";
    cashflowTitle.value = "";
    if (cashflowIsin) cashflowIsin.value = "";
    if (cashflowQuantity) cashflowQuantity.value = "";
    cashflowNote.value = "";
  } catch (error) {
    showError(error.message || "Zahlungsstrom konnte nicht hinzugefügt werden.");
  }
});

function syncRecurringFeeControls() {
  const contribution = recurringType?.value === "contribution";
  if (recurringAmountMode) recurringAmountMode.disabled = !contribution;
  if (recurringPurchaseFee) recurringPurchaseFee.disabled = !contribution || recurringAmountMode?.value !== "net";
}

recurringType?.addEventListener("change", syncRecurringFeeControls);
recurringAmountMode?.addEventListener("change", syncRecurringFeeControls);
syncRecurringFeeControls();

document.querySelector("[data-add-recurring]")?.addEventListener("click", () => {
  try {
    const dates = generateRecurringDates({
      firstDate: recurringFirst.value,
      lastDate: recurringLast.value,
      intervalMonths: Number(recurringInterval.value)
    });
    const rawAmount = parseGermanNumber(recurringAmount.value);
    if (!Number.isFinite(rawAmount) || rawAmount === 0) throw new Error("Bitte einen Betrag ungleich 0 eingeben.");
    let signedAmount;
    if (recurringType.value === "contribution") {
      const investment = initialInvestment({
        amount: Math.abs(rawAmount),
        amountMode: recurringAmountMode?.value || "gross",
        purchaseFeePercent: Number(recurringPurchaseFee?.value || 0)
      });
      signedAmount = -investment.customerOutflow;
    } else {
      signedAmount = normalizeSignedAmount(rawAmount, recurringType.value);
    }
    for (const date of dates) {
      cashflows.push({
        id: nextCashflowId++,
        date,
        type: recurringType.value,
        amount: signedAmount,
        title: recurringTitle.value.trim(),
        note: recurringNote.value.trim(),
        isin: "",
        quantity: null,
        unit: ""
      });
    }
    renderCashflows();
    clearCalculation();
    recurringAmount.value = formatGermanNumber(Math.abs(rawAmount));
  } catch (error) {
    showError(error.message || "Regelmäßige Zahlungen konnten nicht erzeugt werden.");
  }
});



csvImportDialogYes?.addEventListener("click", () => {
  if (csvImportDialogStep === "more") {
    closeCsvImportDialog();
    csvImportAwaitingAdditionalFile = true;
    csvImportFileInput?.click();
    return;
  }
  if (csvImportDialogStep === "start") {
    showDataStatus("CSV-Import abgeschlossen. Bitte Startdatum und Startwert eingeben.");
    endCsvImportSession();
    const purchaseText = enhancedDateInputs.get(purchaseDate);
    (purchaseText || purchaseDate)?.focus();
  }
});

csvImportDialogNo?.addEventListener("click", () => {
  if (csvImportDialogStep === "more") {
    openCsvImportQuestion("start");
    return;
  }
  if (csvImportDialogStep === "start") {
    applyCsvZeroStart();
    endCsvImportSession();
  }
});

csvImportButton?.addEventListener("click", () => {
  beginCsvImportSession();
  csvImportAwaitingAdditionalFile = false;
  csvImportFileInput?.click();
});

csvImportFileInput?.addEventListener("cancel", () => {
  if (csvImportSessionActive && csvImportAwaitingAdditionalFile) {
    csvImportAwaitingAdditionalFile = false;
    openCsvImportQuestion("start");
  }
});

csvImportFileInput?.addEventListener("change", async () => {
  const file = csvImportFileInput.files?.[0];
  csvImportFileInput.value = "";
  if (!file) return;
  beginCsvImportSession();
  csvImportAwaitingAdditionalFile = false;
  clearCalculation();
  try {
    const parsed = await importBankTransactionsCsv(file);
    rememberCsvImportDate(parsed.earliestTransactionDate);
    finishCsvImportSession();
  } catch (error) {
    endCsvImportSession();
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
  if (printStatus) {
    printStatus.hidden = true;
    printStatus.textContent = "";
  }
}

function selectedPrintCashflowMode() {
  return printCashflowsMode?.value === "details" && cashflows.length > 0;
}

function selectedPrintHistoryCharts() {
  return Boolean(printHistoryCharts?.checked && lastDepotHistory);
}

function updatePrintOptionsState() {
  if (!printCashflowsMode) return;
  const detailsOption = printCashflowsMode.querySelector('option[value="details"]');
  if (detailsOption) detailsOption.disabled = cashflows.length === 0;
  if (cashflows.length === 0 && printCashflowsMode.value === "details") {
    printCashflowsMode.value = "summary";
  }
  if (printCashflowsHint) {
    printCashflowsHint.textContent = cashflows.length
      ? `${cashflows.length} zusätzliche Zahlungsströme vorhanden.`
      : "Keine zusätzlichen Zahlungsströme vorhanden.";
  }
  if (printHistoryCharts) {
    printHistoryCharts.disabled = !lastDepotHistory;
  }
  if (printHistoryChartsHint) {
    printHistoryChartsHint.textContent = lastDepotHistory
      ? "Verwendet die aktuell ausgewählten Diagrammlinien."
      : "Keine historische Depotentwicklung verfügbar.";
  }
}

printButton?.addEventListener("click", () => {
  if (!printOptions) return;
  updatePrintOptionsState();
  if (printCashflowsMode) printCashflowsMode.value = "summary";
  if (printConfirmButton) printConfirmButton.hidden = isIosDevice();
  if (printStatus) { printStatus.hidden = true; printStatus.textContent = ""; }
  printOptions.hidden = false;
  pdfConfirmButton?.focus();
});

printCancelButton?.addEventListener("click", closePrintOptions);
printOptions?.addEventListener("click", (event) => {
  if (event.target === printOptions) closePrintOptions();
});

const PDF_BENCHMARK_COLORS = {
  overnight: [0.847, 0.678, 0.341],
  euribor3m: [0.784, 0.541, 0.196],
  euribor6m: [0.710, 0.420, 0.157],
  euribor12m: [0.569, 0.298, 0.133]
};
const PDF_FUND_COLOR = [0.110, 0.455, 0.573];

function safePdfText(value) {
  return String(value ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[“”„]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/×/g, "x")
    .replace(/…/g, "...")
    .replace(/\u00a0/g, " ");
}

function sanitizePdfFilename(value) {
  const base = safeFilenamePart(value) || "Depotrendite";
  return `${base}.pdf`;
}

async function createPdfBytes({ includeCashflows = false, includeHistoryCharts = false } = {}) {
  if (!lastCoreCalculation || resultsNode?.hidden) throw new Error("Bitte zuerst eine Depotrendite berechnen.");

  const { PDFDocument, StandardFonts, rgb } = await import("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm");
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Toolbox – Depotrendite${designation?.value?.trim() ? ` – ${designation.value.trim()}` : ""}`);
  pdfDoc.setAuthor("Toolbox");
  pdfDoc.setCreator(`Toolbox v${SITE_VERSION}`);

  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 42;
  const CONTENT_W = PAGE_W - 2 * MARGIN;
  const LINE = 14;
  let page;
  let y;

  function addPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
    return page;
  }

  function ensureSpace(height) {
    if (!page || y - height < MARGIN) addPage();
  }

  function textWidth(text, font, size) {
    return font.widthOfTextAtSize(safePdfText(text), size);
  }

  function wrapText(text, font, size, maxWidth) {
    const raw = safePdfText(text);
    const paragraphs = raw.split(/\n/);
    const lines = [];
    for (const paragraph of paragraphs) {
      if (!paragraph) { lines.push(""); continue; }
      const words = paragraph.split(/\s+/);
      let current = "";
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (!current || textWidth(candidate, font, size) <= maxWidth) {
          current = candidate;
        } else {
          lines.push(current);
          current = word;
        }
      }
      if (current) lines.push(current);
    }
    return lines;
  }

  function drawTextLine(text, x, yy, { font = regular, size = 9.5, color = rgb(0.09, 0.13, 0.18) } = {}) {
    page.drawText(safePdfText(text), { x, y: yy, size, font, color });
  }

  function drawWrapped(text, { x = MARGIN, width = CONTENT_W, font = regular, size = 9.5, color = rgb(0.20, 0.28, 0.34), lineHeight = 13 } = {}) {
    const lines = wrapText(text, font, size, width);
    ensureSpace(lines.length * lineHeight + 2);
    for (const line of lines) {
      drawTextLine(line, x, y, { font, size, color });
      y -= lineHeight;
    }
    return lines.length;
  }

  function sectionTitle(title) {
    ensureSpace(28);
    y -= 4;
    drawTextLine(title, MARGIN, y, { font: bold, size: 13, color: rgb(0.04, 0.16, 0.25) });
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.8, color: rgb(0.82, 0.86, 0.89) });
    y -= 16;
  }

  function keyValue(label, value, column = 0) {
    const colW = (CONTENT_W - 14) / 2;
    const x = MARGIN + column * (colW + 14);
    drawTextLine(label, x, y, { font: regular, size: 8, color: rgb(0.35, 0.43, 0.49) });
    drawTextLine(value, x, y - 13, { font: bold, size: 10, color: rgb(0.06, 0.12, 0.18) });
  }

  function colorFor(kind) {
    const values = kind === "fund" ? PDF_FUND_COLOR : (PDF_BENCHMARK_COLORS[kind] || [0.65, 0.45, 0.20]);
    return rgb(...values);
  }

  function drawBarRows(items, valueKey, formatter, title) {
    ensureSpace(42 + items.length * 28);
    drawTextLine(title, MARGIN, y, { font: bold, size: 10.5 });
    y -= 18;
    const values = items.map((item) => Number(item[valueKey]) || 0);
    const max = Math.max(...values.map((v) => Math.max(v, 0)), 0.000001);
    const labelW = 92;
    const valueW = 86;
    const trackX = MARGIN + labelW;
    const trackW = CONTENT_W - labelW - valueW - 8;
    for (const item of items) {
      ensureSpace(28);
      drawTextLine(item.label, MARGIN, y + 2, { size: 8.8 });
      page.drawRectangle({ x: trackX, y: y - 1, width: trackW, height: 8, color: rgb(0.91, 0.93, 0.94) });
      const raw = Number(item[valueKey]) || 0;
      const width = raw > 0 ? Math.max(1.5, trackW * raw / max) : 0;
      if (width > 0) page.drawRectangle({ x: trackX, y: y - 1, width, height: 8, color: colorFor(item.kind) });
      const valueText = formatter(raw);
      drawTextLine(valueText, PAGE_W - MARGIN - Math.min(valueW, textWidth(valueText, bold, 8.8)), y + 2, { font: bold, size: 8.8 });
      y -= 24;
    }
    y -= 4;
  }


  function pdfColorFromHex(hex) {
    const match = /^#([0-9a-f]{6})$/i.exec(String(hex || ""));
    if (!match) return rgb(0.2, 0.4, 0.5);
    const value = Number.parseInt(match[1], 16);
    return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
  }

  function drawPdfHistoryChart(title, series, formatter) {
    const visible = series.filter((item) => historySeriesIsSelected(item.key, item.defaultSelected));
    const finitePoints = visible.flatMap((item) => item.points.filter((point) => Number.isFinite(Number(point.value))));
    if (!visible.length || !finitePoints.length) return false;

    const chartHeight = 150;
    const legendRows = Math.max(1, Math.ceil(visible.length / 3));
    const required = 34 + legendRows * 13 + chartHeight + 34;
    ensureSpace(required);
    drawTextLine(title, MARGIN, y, { font: bold, size: 10.5 });
    y -= 17;

    let legendX = MARGIN;
    let legendItemsInRow = 0;
    for (const item of visible) {
      const label = safePdfText(item.label);
      const labelW = Math.min(135, textWidth(label, regular, 7.2));
      const itemW = 18 + labelW + 12;
      if (legendItemsInRow >= 3 || legendX + itemW > PAGE_W - MARGIN) {
        y -= 12;
        legendX = MARGIN;
        legendItemsInRow = 0;
      }
      page.drawLine({ start: { x: legendX, y: y + 3 }, end: { x: legendX + 12, y: y + 3 }, thickness: 1.6, color: pdfColorFromHex(item.color) });
      let shown = label;
      while (shown.length > 8 && textWidth(shown, regular, 7.2) > 135) shown = `${shown.slice(0, -2)}…`;
      drawTextLine(shown, legendX + 17, y, { size: 7.2 });
      legendX += itemW;
      legendItemsInRow += 1;
    }
    y -= 16;

    const chartTop = y;
    const chartBottom = chartTop - chartHeight;
    const chartLeft = MARGIN + 52;
    const chartRight = PAGE_W - MARGIN - 8;
    const chartW = chartRight - chartLeft;
    const dates = finitePoints.map((point) => point.date).sort();
    const startDate = dates[0];
    const endDateValue = dates[dates.length - 1];
    const startMs = Date.parse(`${startDate}T00:00:00Z`);
    const endMs = Date.parse(`${endDateValue}T00:00:00Z`);
    const values = finitePoints.map((point) => Number(point.value));
    let minY = Math.min(...values, 0);
    let maxY = Math.max(...values, 0);
    if (Math.abs(maxY - minY) < 1e-12) {
      const pad = Math.max(Math.abs(maxY) * 0.1, 1);
      minY -= pad;
      maxY += pad;
    }
    const spanY = maxY - minY;
    const x = (date) => chartLeft + ((Date.parse(`${date}T00:00:00Z`) - startMs) / Math.max(endMs - startMs, 1)) * chartW;
    const py = (value) => chartBottom + ((value - minY) / spanY) * chartHeight;

    const yTicks = Array.from({ length: 5 }, (_, index) => minY + spanY * index / 4);
    for (const tick of yTicks) {
      const yy = py(tick);
      page.drawLine({ start: { x: chartLeft, y: yy }, end: { x: chartRight, y: yy }, thickness: 0.45, color: rgb(0.88, 0.90, 0.91) });
      const label = safePdfText(formatter(tick));
      const labelWidth = textWidth(label, regular, 6.2);
      drawTextLine(label, chartLeft - 5 - labelWidth, yy - 2, { size: 6.2, color: rgb(0.35, 0.43, 0.47) });
    }
    page.drawLine({ start: { x: chartLeft, y: chartBottom }, end: { x: chartRight, y: chartBottom }, thickness: 0.65, color: rgb(0.55, 0.61, 0.64) });
    page.drawLine({ start: { x: chartLeft, y: chartBottom }, end: { x: chartLeft, y: chartTop }, thickness: 0.65, color: rgb(0.55, 0.61, 0.64) });

    for (const item of visible) {
      let previous = null;
      const color = pdfColorFromHex(item.color);
      for (const point of item.points) {
        const value = Number(point.value);
        if (!Number.isFinite(value)) {
          previous = null;
          continue;
        }
        const current = { x: x(point.date), y: py(value) };
        if (previous) page.drawLine({ start: previous, end: current, thickness: 1.15, color });
        previous = current;
      }
    }

    const middleMs = startMs + (endMs - startMs) / 2;
    const dateLabels = [
      { date: startDate, pos: chartLeft, anchor: "left" },
      { date: new Date(middleMs).toISOString().slice(0, 10), pos: chartLeft + chartW / 2, anchor: "middle" },
      { date: endDateValue, pos: chartRight, anchor: "right" }
    ];
    for (const item of dateLabels) {
      const label = new Intl.DateTimeFormat("de-AT", { month: "2-digit", year: "numeric" }).format(new Date(`${item.date}T00:00:00Z`));
      const labelW = textWidth(label, regular, 6.7);
      let xx = item.pos;
      if (item.anchor === "middle") xx -= labelW / 2;
      if (item.anchor === "right") xx -= labelW;
      drawTextLine(label, xx, chartBottom - 14, { size: 6.7, color: rgb(0.35, 0.43, 0.47) });
    }
    y = chartBottom - 28;
    return true;
  }

  addPage();
  drawTextLine("TOOLBOX", MARGIN, y, { font: bold, size: 10, color: rgb(...PDF_FUND_COLOR) });
  y -= 24;
  drawTextLine("Depotrendite & Vergleich", MARGIN, y, { font: bold, size: 22, color: rgb(0.03, 0.15, 0.25) });
  y -= 22;
  if (designation?.value?.trim()) {
    drawWrapped(designation.value.trim(), { font: bold, size: 11, color: rgb(0.23, 0.31, 0.37), lineHeight: 14 });
  }
  drawTextLine(`Erstellt: ${new Intl.DateTimeFormat("de-AT", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}  ·  Toolbox v${SITE_VERSION}`, MARGIN, y, { size: 8, color: rgb(0.40, 0.46, 0.51) });
  y -= 24;

  const calc = lastCoreCalculation.calc;
  const fundXirr = lastCoreCalculation.xirrResult;
  sectionTitle("Eingaben");
  const startAmountValue = parseGermanNumber(initialAmount?.value);
  const endAmountValue = parseGermanNumber(endValue?.value);
  const inputPairs = [
    ["Kauf-/Startdatum", formatReportDate(purchaseDate?.value)],
    ["Startbetrag", Number.isFinite(startAmountValue) ? currency.format(startAmountValue) : "-"],
    ["Startbetrag ist", selectedOptionText(initialAmountMode)],
    ["Kaufspesen Start-/Einmalanlage", `${percent.format(Number(purchaseFee?.value || 0))} %`],
    ["Kaufspesen Sparrate/Dauerauftrag", `${percent.format(Number(recurringPurchaseFee?.value || 0))} %`],
    ["End-/Bewertungsdatum", formatReportDate(endDate?.value)],
    ["End-/Verkaufswert", Number.isFinite(endAmountValue) ? currency.format(endAmountValue) : "-"],
    ["KESt-Befreiung", selectedOptionText(kestExemption)],
    ["Zusätzliche Zahlungsströme", String(cashflows.length)]
  ];
  for (let i = 0; i < inputPairs.length; i += 2) {
    ensureSpace(40);
    keyValue(inputPairs[i][0], inputPairs[i][1], 0);
    if (inputPairs[i + 1]) keyValue(inputPairs[i + 1][0], inputPairs[i + 1][1], 1);
    y -= 38;
  }

  sectionTitle("Ergebnisse");
  const summary = summarizeCashflows(calc.investorFlows);
  const benchmarkItems = lastBenchmarkResults.map((item) => ({
    label: item.config.shortLabel || item.config.label,
    kind: item.kind,
    endValue: item.benchmark.balance,
    rate: item.xirrResult.rate
  }));
  const resultItems = [
    { label: "Depot", kind: "fund", endValue: calc.terminalValue, rate: fundXirr.rate },
    ...benchmarkItems
  ];
  drawTextLine(`Depotrendite: ${percent.format(fundXirr.rate * 100)} % p.a.`, MARGIN, y, { font: bold, size: 14, color: colorFor("fund") });
  y -= 19;
  drawTextLine(`Wirtschaftlicher Überschuss: ${currency.format(summary.net)}`, MARGIN, y, { font: bold, size: 11 });
  y -= 23;
  for (const item of benchmarkItems) {
    ensureSpace(22);
    drawTextLine(`${item.label}: ${percent.format(item.rate * 100)} % p.a. · Endwert ${currency.format(item.endValue)}`, MARGIN, y, { font: bold, size: 9.5, color: colorFor(item.kind) });
    y -= 17;
  }
  y -= 6;
  if (benchmarkItems.length) {
    drawBarRows(resultItems, "endValue", (v) => currency.format(v), "Endwert am Bewertungsdatum");
    const rateItems = resultItems.map((item) => ({ ...item, ratePct: Math.max(item.rate * 100, 0) }));
    drawBarRows(rateItems, "ratePct", (v) => `${percent.format(v)} %`, "Effektivrendite p.a.");
  }

  const planTexts = savingsPlanList ? [...savingsPlanList.querySelectorAll("li")].map((li) => li.textContent.trim()).filter(Boolean) : [];
  if (planTexts.length) {
    sectionTitle("Erkannte Sparpläne");
    for (const line of planTexts) {
      drawWrapped(`• ${line}`, { size: 9.2, lineHeight: 13 });
      y -= 2;
    }
  }

  if (includeHistoryCharts && lastDepotHistory) {
    sectionTitle("Historische Depotentwicklung");
    drawWrapped(`Zeitraum ${formatReportDate(lastDepotHistory.startDate)} bis ${formatReportDate(lastDepotHistory.endDate)} · Depotwert am Ende ${currency.format(lastDepotHistory.lastValue)} · kumulierte Nettoinvestitionen ${currency.format(lastDepotHistory.lastNetInvested)}.`, { size: 8.4, lineHeight: 11.5 });
    y -= 6;
    const historyDefs = historySeriesDefinitions(lastDepotHistory);
    drawPdfHistoryChart("Wertentwicklung", historyDefs.valueSeries, (value) => chartCurrency.format(value));
    y -= 5;
    drawPdfHistoryChart("Historische Renditen (XIRR p.a.)", historyDefs.returnSeries, (value) => `${chartPercent.format(value * 100)} %`);
    y -= 4;
  }

  sectionTitle("Berechnungsdetails");
  const details = [
    ["Kundenaufwand Start", currency.format(calc.start.customerOutflow)],
    ["Netto investiert", currency.format(calc.start.netInvested)],
    ["Kaufspesen", currency.format(calc.start.feeAmount)],
    ["End-/Verkaufswert", currency.format(calc.terminalValue)],
    ["KESt-Befreiung", calc.isKestExempt ? "Ja" : "Nein"]
  ];
  for (const [labelText, valueText] of details) {
    ensureSpace(18);
    drawTextLine(labelText, MARGIN, y, { size: 8.5, color: rgb(0.35, 0.43, 0.49) });
    drawTextLine(valueText, MARGIN + 180, y, { font: bold, size: 9 });
    y -= 16;
  }
  y -= 6;
  drawWrapped(nodes.method?.textContent || "", { size: 8.2, lineHeight: 11.5 });

  if (includeCashflows && cashflows.length) {
    sectionTitle(`Einzelne Zahlungsströme (${cashflows.length})`);
    const ordered = [...cashflows].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    const cols = [MARGIN, MARGIN + 70, MARGIN + 205, MARGIN + 285, MARGIN + 390];
    const headers = ["Datum", "Art", "Betrag", "Titel", "Notiz"];
    ensureSpace(24);
    headers.forEach((header, i) => drawTextLine(header, cols[i], y, { font: bold, size: 7.4 }));
    y -= 13;
    page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: PAGE_W - MARGIN, y: y + 4 }, thickness: 0.6, color: rgb(0.75, 0.79, 0.82) });
    for (const flow of ordered) {
      if (y < MARGIN + 35) {
        addPage();
        headers.forEach((header, i) => drawTextLine(header, cols[i], y, { font: bold, size: 7.4 }));
        y -= 13;
      }
      const values = [
        formatReportDate(flow.date),
        typeLabels[flow.type] || flow.type,
        currency.format(flow.amount),
        flow.title || "",
        flow.note || ""
      ];
      values.forEach((value, i) => {
        const max = i === 1 ? 20 : i === 3 ? 18 : i === 4 ? 16 : 14;
        let text = safePdfText(value);
        if (text.length > max) text = `${text.slice(0, Math.max(1, max - 1))}…`;
        drawTextLine(text, cols[i], y, { size: 6.9 });
      });
      y -= 11.5;
    }
  } else if (cashflows.length) {
    sectionTitle("Zahlungsströme");
    drawWrapped(`${cashflows.length} Einzelbuchungen wurden auf Wunsch nicht im PDF ausgegeben.`, { size: 9 });
  }

  sectionTitle("Hinweis");
  drawWrapped("Die Berechnung ist eine mathematische Vergleichsrechnung. Steuerliche, rechtliche, produktbezogene oder abrechnungstechnische Besonderheiten können abweichen. Historische Benchmarks sind Referenzrechnungen und keine konkreten Anlageangebote.", { size: 8.2, lineHeight: 11.5 });

  return pdfDoc.save();
}

function isIosDevice() {
  return /iP(ad|hone|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

async function openGeneratedPdf(bytes, previewWindow = null) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const filename = sanitizePdfFilename(designation?.value?.trim() ? `Toolbox_Depotrendite_${designation.value.trim()}` : "Toolbox_Depotrendite");

  // Auf iOS wird das Vorschaufenster bereits im direkten Tap geöffnet; sonst kann Safari den späteren Popup blockieren.
  if (isIosDevice()) {
    if (previewWindow && !previewWindow.closed) {
      previewWindow.location.replace(url);
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.append(link);
      link.click();
      link.remove();
    }
  } else {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

pdfConfirmButton?.addEventListener("click", async () => {
  const includeCashflows = selectedPrintCashflowMode();
  const includeHistoryCharts = selectedPrintHistoryCharts();
  let previewWindow = null;
  if (isIosDevice()) {
    previewWindow = window.open("", "_blank");
    if (previewWindow) {
      previewWindow.document.write('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>PDF wird erstellt</title></head><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:2rem"><p>PDF wird erstellt …</p></body></html>');
      previewWindow.document.close();
    }
  }
  if (printStatus) {
    printStatus.textContent = "PDF wird erstellt …";
    printStatus.hidden = false;
  }
  if (pdfConfirmButton) pdfConfirmButton.disabled = true;
  try {
    const bytes = await createPdfBytes({ includeCashflows, includeHistoryCharts });
    await openGeneratedPdf(bytes, previewWindow);
    if (printStatus) printStatus.textContent = "PDF wurde erstellt. Am iPhone öffnet es sich in einem neuen Tab; dort kannst du es über Teilen speichern oder drucken.";
  } catch (error) {
    if (previewWindow && !previewWindow.closed) {
      previewWindow.document.body.textContent = `PDF konnte nicht erstellt werden: ${error.message || error}`;
      previewWindow.document.body.style.fontFamily = "-apple-system,BlinkMacSystemFont,sans-serif";
      previewWindow.document.body.style.padding = "2rem";
    }
    if (printStatus) {
      printStatus.textContent = `PDF konnte nicht erstellt werden: ${error.message || error}`;
      printStatus.hidden = false;
    }
  } finally {
    if (pdfConfirmButton) pdfConfirmButton.disabled = false;
  }
});

printConfirmButton?.addEventListener("click", () => {
  const includeCashflows = selectedPrintCashflowMode();
  const includeHistoryCharts = selectedPrintHistoryCharts();
  if (!buildPrintReport({ includeCashflows, includeHistoryCharts })) return;
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


useHistoryEndValueButton?.addEventListener("click", async () => {
  if (!endValue) return;
  const button = useHistoryEndValueButton;
  button.disabled = true;
  clearCalculation();
  try {
    const history = await refreshDepotHistory(buildHistoryContext());
    if (!history) throw new Error("Historischer Depotwert konnte nicht ermittelt werden.");
    endValue.value = formatGermanNumber(history.lastValue);
    showDataStatus(`Depotwert ${currency.format(history.lastValue)} zum ${formatReportDate(history.endDate)} aus historischen Rücknahmepreisen übernommen. Die Depotrendite kann jetzt berechnet werden.`);
  } catch (error) {
    showError(error.message || "Historischer Depotwert konnte nicht ermittelt werden.");
  } finally {
    button.disabled = false;
  }
});

resetButton?.addEventListener("click", () => {
  form?.reset();
  syncRecurringFeeControls();
  cashflows = [];
  nextCashflowId = 1;
  csvImportSessionActive = false;
  csvImportSessionEarliestDate = null;
  csvImportAwaitingAdditionalFile = false;
  closeCsvImportDialog();
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
    lastBenchmarkResults = await refreshBenchmarks(calc, xirrResult, runRevision);
    if (runRevision === calculationRevision) enrichDepotHistoryWithBenchmarks(calc, lastBenchmarkResults);
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

    try {
      await refreshDepotHistory(calc);
    } catch (historyError) {
      if (depotHistory) depotHistory.hidden = false;
      setDepotHistoryStatus(historyError.message || "Historische Depotwertentwicklung konnte nicht geladen werden.", true);
    }

    window.requestAnimationFrame(() => {
      resultsNode?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
    });

    lastBenchmarkResults = await refreshBenchmarks(calc, xirrResult, runRevision);
    if (runRevision !== calculationRevision) return;
    enrichDepotHistoryWithBenchmarks(calc, lastBenchmarkResults);
    if (printButton) printButton.hidden = false;
  } catch (error) {
    showError(error.message || "Berechnung nicht möglich.");
  }
});

function todayIsoLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ensureDefaultEndDate() {
  if (endDate && !endDate.value) endDate.value = todayIsoLocal();
}

ensureDefaultEndDate();
enhanceDateInputs(document);
syncEnhancedDateInputs();
renderCashflows();

form?.addEventListener("reset", () => {
  window.setTimeout(() => {
    ensureDefaultEndDate();
    syncEnhancedDateInputs();
  }, 0);
});
