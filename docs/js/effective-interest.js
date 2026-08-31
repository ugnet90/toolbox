import {
  ceilPercentToHundredth,
  formatIsoDate,
  viennaDateTimeParts
} from "./bundesschatz-utils.js";
import { calculateEffectiveInterest } from "./effective-interest-utils.js";

const form = document.querySelector("[data-effective-form]");
const errorNode = document.querySelector("[data-effective-error]");
const warningNode = document.querySelector("[data-tax-warning]");
const resultsNode = document.querySelector("[data-effective-results]");
const detailsNode = document.querySelector("[data-effective-details]");
const insuranceTaxSelect = document.querySelector("#insuranceTax");
const kestRateSelect = document.querySelector("#kestRate");

const nodes = {
  effectiveRate: document.querySelector("[data-effective-rate]"),
  totalReturn: document.querySelector("[data-total-return]"),
  bankRate: document.querySelector("[data-bank-rate]"),
  insuranceTaxAmount: document.querySelector("[data-insurance-tax-amount]"),
  netInvestment: document.querySelector("[data-net-investment]"),
  kestRate: document.querySelector("[data-kest-rate]"),
  kestAmount: document.querySelector("[data-kest-amount]"),
  netPayout: document.querySelector("[data-net-payout]"),
  startDate: document.querySelector("[data-start-date]"),
  endDate: document.querySelector("[data-end-date]"),
  bankRateExact: document.querySelector("[data-bank-rate-exact]")
};

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

const exactPercent = new Intl.NumberFormat("de-AT", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4
});

const outputNodes = Object.values(nodes).filter(Boolean);

function parseAmount(value) {
  let normalized = String(value ?? "").trim().replace(/[\s']/g, "");
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");

  if (comma >= 0 && dot >= 0) {
    if (comma > dot) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (comma >= 0) {
    normalized = normalized.replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }

  return Number(normalized);
}

function clearCalculation() {
  if (errorNode) {
    errorNode.textContent = "";
    errorNode.hidden = true;
  }
  if (resultsNode) resultsNode.hidden = true;
  if (detailsNode) {
    detailsNode.hidden = true;
    detailsNode.open = false;
  }
  outputNodes.forEach((node) => {
    node.textContent = "";
  });
}

function updateTaxWarning() {
  if (!warningNode) return;
  const insuranceTax = Number(insuranceTaxSelect?.value ?? 0);
  const kest = Number(kestRateSelect?.value ?? 0);
  const unusualCombination = insuranceTax > 0 && kest > 0;

  warningNode.hidden = !unusualCombination;
  warningNode.textContent = unusualCombination
    ? "Hinweis: Versicherungssteuer über 0 % wird üblicherweise mit 0 % KESt kombiniert. Bitte prüfe diese Eingabekombination."
    : "";
}

function showError(message) {
  errorNode.textContent = message;
  errorNode.hidden = false;
  resultsNode.hidden = true;
  detailsNode.hidden = true;
}

function render(result) {
  nodes.effectiveRate.textContent = `${percent.format(result.annualizedNetReturn * 100)} % p.a.`;
  nodes.totalReturn.textContent = `${percent.format(result.totalNetReturn * 100)} %`;

  if (result.bankRateNotRequired) {
    nodes.bankRate.textContent = "≤ 0,00 % p.a.";
    nodes.bankRateExact.textContent = "Kein positiver Spareinlagen-Zinssatz erforderlich.";
  } else {
    const displayRate = ceilPercentToHundredth(result.bankRate);
    nodes.bankRate.textContent = `${percent.format(displayRate)} % p.a.`;
    nodes.bankRateExact.textContent = `${exactPercent.format(result.bankRate * 100)} % p.a.`;
  }

  nodes.insuranceTaxAmount.textContent = currency.format(result.insuranceTaxAmount);
  nodes.netInvestment.textContent = currency.format(result.netInvestment);
  nodes.kestRate.textContent = `${percent.format(result.kestRate * 100)} %`;
  nodes.kestAmount.textContent = currency.format(result.kestAmount);
  nodes.netPayout.textContent = currency.format(result.netPayout);
  nodes.startDate.textContent = formatIsoDate(result.startDate);
  nodes.endDate.textContent = formatIsoDate(result.endDate);

  errorNode.hidden = true;
  resultsNode.hidden = false;
  detailsNode.hidden = false;
}

function handleInputChange() {
  clearCalculation();
  updateTaxWarning();
}

form?.addEventListener("input", handleInputChange);
form?.addEventListener("change", handleInputChange);

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  clearCalculation();
  updateTaxWarning();

  const data = new FormData(form);
  try {
    const result = calculateEffectiveInterest({
      depositAmount: parseAmount(data.get("depositAmount")),
      payoutAmount: parseAmount(data.get("payoutAmount")),
      termValue: Number(data.get("termValue")),
      termUnit: String(data.get("termUnit")),
      kestPercent: Number(data.get("kestRate")),
      insuranceTaxPercent: Number(data.get("insuranceTax")),
      startDate: viennaDateTimeParts().date
    });
    render(result);
  } catch (error) {
    showError(error.message || "Berechnung nicht möglich.");
  }
});

updateTaxWarning();
