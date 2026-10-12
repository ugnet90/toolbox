import { calculateInterest } from "./interest-calculator-utils.js?v=0.8.1";

const STORAGE_KEY = "toolbox:interest-calculator:method:v1";
const DEFAULT_METHOD = "ACT_360";
const ALLOWED_METHODS = new Set(["ACT_360", "ACT_365", "30_360"]);

const form = document.querySelector("[data-interest-form]");
const errorNode = document.querySelector("[data-interest-error]");
const resultsNode = document.querySelector("[data-interest-results]");
const methodSelect = document.querySelector("#calculationMethod");
const periodModeSelect = document.querySelector("#periodMode");
const debitRateInput = document.querySelector("#debitRatePercent");
const overdraftRateInput = document.querySelector("#overdraftRatePercent");
const limitInput = document.querySelector("#limitAmount");
const amountInput = document.querySelector("#amount");
const startDateInput = document.querySelector("#startDate");
const endDateInput = document.querySelector("#endDate");
const dayCountInput = document.querySelector("#dayCount");

const overdraftField = document.querySelector("[data-overdraft-field]");
const periodModeField = document.querySelector("[data-period-mode-field]");
const dateFields = document.querySelector("[data-date-fields]");
const daysField = document.querySelector("[data-days-field]");
const methodField = document.querySelector("[data-method-field]");
const submitButton = document.querySelector("[data-submit-button]");

const amountInputs = [limitInput, amountInput];

const output = {
  debitInterest: document.querySelector("[data-debit-interest]"),
  overdraftInterest: document.querySelector("[data-overdraft-interest]"),
  totalInterest: document.querySelector("[data-total-interest]"),
  period: document.querySelector("[data-period-meta]")
};

const currency = new Intl.NumberFormat("de-AT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

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
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }
  return Number(normalized);
}

function optionalAmount(value) {
  return String(value ?? "").trim() === "" ? 0 : parseGermanNumber(value);
}

function formatAmountValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat("de-AT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(number);
}

function formatAmountInput(input) {
  if (!input || !input.value.trim()) return;
  const value = parseGermanNumber(input.value);
  if (Number.isFinite(value)) input.value = formatAmountValue(value);
}

function clearResults() {
  if (errorNode) {
    errorNode.textContent = "";
    errorNode.hidden = true;
  }
  if (resultsNode) resultsNode.hidden = true;
  Object.values(output).forEach((node) => {
    if (node) node.textContent = "";
  });
}

function loadStoredMethod() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return ALLOWED_METHODS.has(stored) ? stored : DEFAULT_METHOD;
  } catch {
    return DEFAULT_METHOD;
  }
}

function saveMethod(value) {
  if (!ALLOWED_METHODS.has(value)) return;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Lokale Speicherung ist Komfortfunktion; Berechnung bleibt nutzbar.
  }
}

function methodLabel(value) {
  if (value === "ACT_365") return "act/365";
  if (value === "30_360") return "30/360";
  return "act/360";
}

function hasValidBaseInputs() {
  const debitRate = parseGermanNumber(debitRateInput?.value);
  const amount = parseGermanNumber(amountInput?.value);
  const limit = optionalAmount(limitInput?.value);
  return Number.isFinite(debitRate) && debitRate >= 0 && Number.isFinite(amount) && amount >= 0 && Number.isFinite(limit) && limit >= 0;
}

function needsOverdraftRate() {
  const amount = parseGermanNumber(amountInput?.value);
  const limit = optionalAmount(limitInput?.value);
  return Number.isFinite(amount) && Number.isFinite(limit) && amount > limit;
}

function overdraftInputReady() {
  if (!needsOverdraftRate()) return true;
  const rate = parseGermanNumber(overdraftRateInput?.value);
  return Number.isFinite(rate) && rate >= 0;
}

function periodInputReady() {
  if (periodModeSelect?.value === "DAYS") {
    const days = Number(dayCountInput?.value);
    return Number.isInteger(days) && days >= 0;
  }
  return Boolean(startDateInput?.value && endDateInput?.value);
}

function updateProgressiveFields() {
  const baseReady = hasValidBaseInputs();
  const overdraftNeeded = baseReady && needsOverdraftRate();
  if (overdraftField) overdraftField.hidden = !overdraftNeeded;

  const ratesReady = baseReady && overdraftInputReady();
  if (periodModeField) periodModeField.hidden = !ratesReady;

  const showPeriodInputs = ratesReady;
  const useDays = periodModeSelect?.value === "DAYS";
  if (dateFields) dateFields.hidden = !showPeriodInputs || useDays;
  if (daysField) daysField.hidden = !showPeriodInputs || !useDays;

  const periodReady = ratesReady && periodInputReady();
  if (methodField) methodField.hidden = !periodReady;
  if (submitButton) submitButton.hidden = !periodReady;
}

function render(result) {
  output.debitInterest.textContent = currency.format(result.debitInterest);
  output.overdraftInterest.textContent = currency.format(result.overdraftInterest);
  output.totalInterest.textContent = currency.format(result.totalInterest);
  output.period.textContent = `${result.days} Zinstag${result.days === 1 ? "" : "e"} · ${methodLabel(result.method)}`;
  errorNode.hidden = true;
  resultsNode.hidden = false;
}

function showError(message) {
  errorNode.textContent = message;
  errorNode.hidden = false;
  resultsNode.hidden = true;
}

if (methodSelect) methodSelect.value = loadStoredMethod();
updateProgressiveFields();

form?.addEventListener("input", () => {
  clearResults();
  updateProgressiveFields();
});

form?.addEventListener("change", (event) => {
  clearResults();
  if (event.target === methodSelect) saveMethod(methodSelect.value);
  updateProgressiveFields();
});

amountInputs.forEach((input) => {
  input?.addEventListener("blur", () => {
    formatAmountInput(input);
    updateProgressiveFields();
  });
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  clearResults();
  amountInputs.forEach(formatAmountInput);

  const data = new FormData(form);
  const useDays = String(data.get("periodMode") || "DATES") === "DAYS";
  const limit = optionalAmount(data.get("limitAmount"));
  const amount = parseGermanNumber(data.get("amount"));
  const overdraftNeeded = Number.isFinite(amount) && Number.isFinite(limit) && amount > limit;

  try {
    const result = calculateInterest({
      debitRatePercent: parseGermanNumber(data.get("debitRatePercent")),
      overdraftRatePercent: overdraftNeeded ? parseGermanNumber(data.get("overdraftRatePercent")) : 0,
      limitAmount: limit,
      amount,
      startDate: useDays ? "" : String(data.get("startDate") || ""),
      endDate: useDays ? "" : String(data.get("endDate") || ""),
      dayCount: useDays ? String(data.get("dayCount") ?? "") : null,
      calculationMethod: String(data.get("calculationMethod") || DEFAULT_METHOD)
    });
    saveMethod(result.method);
    render(result);
  } catch (error) {
    showError(error?.message || "Berechnung nicht möglich.");
  }
});
