import { calculateInterest } from "./interest-calculator-utils.js?v=0.8.0";

const STORAGE_KEY = "toolbox:interest-calculator:method:v1";
const DEFAULT_METHOD = "ACT_360";
const ALLOWED_METHODS = new Set(["ACT_360", "ACT_365", "30_360"]);

const form = document.querySelector("[data-interest-form]");
const errorNode = document.querySelector("[data-interest-error]");
const resultsNode = document.querySelector("[data-interest-results]");
const methodSelect = document.querySelector("#calculationMethod");
const amountInputs = [document.querySelector("#limitAmount"), document.querySelector("#amount")];

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

form?.addEventListener("input", clearResults);
form?.addEventListener("change", (event) => {
  clearResults();
  if (event.target === methodSelect) saveMethod(methodSelect.value);
});

amountInputs.forEach((input) => {
  input?.addEventListener("blur", () => formatAmountInput(input));
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  clearResults();
  amountInputs.forEach(formatAmountInput);

  const data = new FormData(form);
  try {
    const result = calculateInterest({
      debitRatePercent: parseGermanNumber(data.get("debitRatePercent")),
      overdraftRatePercent: parseGermanNumber(data.get("overdraftRatePercent")),
      limitAmount: parseGermanNumber(data.get("limitAmount")),
      amount: parseGermanNumber(data.get("amount")),
      startDate: String(data.get("startDate") || ""),
      endDate: String(data.get("endDate") || ""),
      calculationMethod: String(data.get("calculationMethod") || DEFAULT_METHOD)
    });
    saveMethod(result.method);
    render(result);
  } catch (error) {
    showError(error?.message || "Berechnung nicht möglich.");
  }
});
