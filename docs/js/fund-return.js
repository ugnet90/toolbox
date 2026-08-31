import {
  calculateXirr,
  formatGermanNumber,
  generateRecurringDates,
  initialInvestment,
  parseGermanNumber,
  simulateHistoricalSavings,
  summarizeCashflows
} from "./fund-return-utils.js";

const SAVINGS_API = "https://toolbox-bundesschatz-proxy.daniel-koechler.workers.dev/savings-rates";

const form = document.querySelector("[data-fund-form]");
const errorNode = document.querySelector("[data-fund-error]");
const warningNode = document.querySelector("[data-fund-warning]");
const resultsNode = document.querySelector("[data-fund-results]");
const detailsNode = document.querySelector("[data-fund-details]");
const cashflowBody = document.querySelector("[data-cashflow-body]");
const cashflowTableWrap = document.querySelector("[data-cashflow-table-wrap]");
const savingsCard = document.querySelector("[data-savings-card]");
const savingsDiffCard = document.querySelector("[data-savings-diff-card]");
const savingsDetailNodes = [...document.querySelectorAll("[data-savings-detail]")];

const purchaseDate = document.querySelector("#purchaseDate");
const initialAmount = document.querySelector("#initialAmount");
const initialAmountMode = document.querySelector("#initialAmountMode");
const purchaseFee = document.querySelector("#purchaseFee");
const endDate = document.querySelector("#endDate");
const endValue = document.querySelector("#endValue");
const historicalCompare = document.querySelector("#historicalCompare");

const cashflowDate = document.querySelector("#cashflowDate");
const cashflowType = document.querySelector("#cashflowType");
const cashflowAmount = document.querySelector("#cashflowAmount");
const cashflowNote = document.querySelector("#cashflowNote");

const recurringType = document.querySelector("#recurringType");
const recurringAmount = document.querySelector("#recurringAmount");
const recurringInterval = document.querySelector("#recurringInterval");
const recurringFirst = document.querySelector("#recurringFirst");
const recurringLast = document.querySelector("#recurringLast");
const recurringNote = document.querySelector("#recurringNote");

const nodes = {
  xirr: document.querySelector("[data-xirr]"),
  economicResult: document.querySelector("[data-economic-result]"),
  savingsValue: document.querySelector("[data-savings-value]"),
  savingsDifference: document.querySelector("[data-savings-difference]"),
  startOutflow: document.querySelector("[data-start-outflow]"),
  startNet: document.querySelector("[data-start-net]"),
  startFee: document.querySelector("[data-start-fee]"),
  otherOutflows: document.querySelector("[data-other-outflows]"),
  intermediateInflows: document.querySelector("[data-intermediate-inflows]"),
  terminalValue: document.querySelector("[data-terminal-value]"),
  cashflowCount: document.querySelector("[data-cashflow-count]"),
  savingsInterest: document.querySelector("[data-savings-interest]"),
  savingsTax: document.querySelector("[data-savings-tax]"),
  rateCoverage: document.querySelector("[data-rate-coverage]"),
  method: document.querySelector("[data-fund-method]")
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

const typeLabels = {
  contribution: "Zuzahlung / Sparrate",
  distribution: "Ausschüttung",
  tax: "Steuer / agE",
  fee: "Depot-/sonstige Gebühr",
  withdrawal: "Entnahme",
  other: "Sonstiger Cashflow"
};

const defaultNegativeTypes = new Set(["contribution", "tax", "fee"]);
let cashflows = [];
let nextCashflowId = 1;

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
  if (savingsCard) savingsCard.hidden = true;
  if (savingsDiffCard) savingsDiffCard.hidden = true;
  savingsDetailNodes.forEach((node) => { node.hidden = true; });
}

function showError(message) {
  errorNode.textContent = message;
  errorNode.hidden = false;
}

function showWarning(message) {
  warningNode.textContent = message;
  warningNode.hidden = false;
}

function typeOptions(selected) {
  return Object.entries(typeLabels).map(([value, label]) =>
    `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`
  ).join("");
}

function renderCashflows() {
  cashflowBody.innerHTML = "";
  const ordered = [...cashflows].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  for (const flow of ordered) {
    const row = document.createElement("tr");
    row.dataset.cashflowId = String(flow.id);
    row.innerHTML = `
      <td><input class="table-input table-input--date" type="date" value="${flow.date}" data-flow-field="date" aria-label="Datum"></td>
      <td><select class="table-input" data-flow-field="type" aria-label="Art">${typeOptions(flow.type)}</select></td>
      <td><input class="table-input table-input--amount" type="text" inputmode="decimal" value="${formatGermanNumber(flow.amount)}" data-flow-field="amount" aria-label="Betrag"></td>
      <td><input class="table-input" type="text" maxlength="80" value="${escapeHtml(flow.note || "")}" data-flow-field="note" aria-label="Notiz"></td>
      <td><button class="icon-button" type="button" data-delete-cashflow="${flow.id}" aria-label="Zahlung löschen">×</button></td>
    `;
    cashflowBody.append(row);
  }

  cashflowTableWrap.hidden = cashflows.length === 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function addCashflow({ date, type, amount, note = "" }) {
  if (!date) throw new Error("Bitte ein Datum für den Zahlungsstrom eingeben.");
  const signedAmount = normalizeSignedAmount(amount, type);
  cashflows.push({ id: nextCashflowId++, date, type, amount: signedAmount, note: note.trim() });
  renderCashflows();
  clearCalculation();
}

function monthFromDate(iso) {
  return String(iso).slice(0, 7);
}

async function fetchSavingsRates(startIso, endIso) {
  const url = new URL(SAVINGS_API);
  url.searchParams.set("start", monthFromDate(startIso));
  url.searchParams.set("end", monthFromDate(endIso));

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.observations?.length) {
    throw new Error(body?.error || "Historische Spareinlagen-Zinsen konnten nicht geladen werden.");
  }
  return body;
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

  const intermediate = [...cashflows].sort((a, b) => a.date.localeCompare(b.date));
  if (intermediate.some((flow) => flow.date < startDate || flow.date > finishDate)) {
    throw new Error("Alle weiteren Zahlungsströme müssen zwischen Start- und Enddatum liegen.");
  }

  const investorFlows = [
    { date: startDate, amount: -start.customerOutflow, type: "start", note: "Startinvestition" },
    ...intermediate.map((flow) => ({ ...flow })),
    { date: finishDate, amount: terminalValue, type: "terminal", note: "End-/Verkaufswert" }
  ];

  const benchmarkFlows = investorFlows.filter((flow) => flow.type !== "terminal");
  return { start, terminalValue, investorFlows, benchmarkFlows, startDate, finishDate, intermediate };
}

function renderCoreResults(calc, xirrResult) {
  const summary = summarizeCashflows(calc.investorFlows);
  const intermediateSummary = summarizeCashflows(calc.intermediate);
  nodes.xirr.textContent = `${percent.format(xirrResult.rate * 100)} % p.a.`;
  nodes.economicResult.textContent = currency.format(summary.net);
  nodes.startOutflow.textContent = currency.format(calc.start.customerOutflow);
  nodes.startNet.textContent = currency.format(calc.start.netInvested);
  nodes.startFee.textContent = currency.format(calc.start.feeAmount);
  nodes.otherOutflows.textContent = currency.format(Math.max(intermediateSummary.outflows, 0));
  nodes.intermediateInflows.textContent = currency.format(Math.max(intermediateSummary.inflows, 0));
  nodes.terminalValue.textContent = currency.format(calc.terminalValue);
  nodes.cashflowCount.textContent = String(calc.investorFlows.length);

  const multipleRootText = xirrResult.rootCount > 1
    ? " Die Zahlungsstromfolge besitzt mehrere mathematisch mögliche IRR-Lösungen; angezeigt wird die betragsmäßig nächstliegende Lösung zu 0 %."
    : "";

  nodes.method.textContent = `Die Rendite wird als datumsgenaue XIRR aus allen Anleger-Cashflows berechnet. Der Start-Cashflow entspricht dem tatsächlichen Kundenaufwand; Kaufspesen beeinflussen daher die Rendite, ohne dass eine Fondsbesteuerung modelliert wird.${multipleRootText}`;
  if (xirrResult.rootCount > 1) {
    showWarning("Hinweis: Für diese Zahlungsstromfolge existieren mehrere mathematisch mögliche Effektivzinssätze. Details beachten.");
  }

  resultsNode.hidden = false;
  detailsNode.hidden = false;
}

function renderSavings(calc, apiData, savings) {
  const difference = calc.terminalValue - savings.balance;
  nodes.savingsValue.textContent = currency.format(savings.balance);
  nodes.savingsDifference.textContent = `${difference >= 0 ? "+" : ""}${currency.format(difference)}`;
  nodes.savingsInterest.textContent = currency.format(savings.grossInterest);
  nodes.savingsTax.textContent = currency.format(savings.tax);
  nodes.rateCoverage.textContent = `${apiData.first_period} bis ${apiData.last_period}`;

  savingsCard.hidden = false;
  savingsDiffCard.hidden = false;
  savingsDetailNodes.forEach((node) => { node.hidden = false; });
  nodes.method.textContent += " Der historische Sparvergleich verwendet die monatliche ECB-MIR-Serie für täglich fällige österreichische Haushaltseinlagen. Der jeweilige Jahreszinssatz wird taggenau (act/365) auf das alternative Sparguthaben angewendet; positive Zinsen werden zum Jahresende bzw. Vergleichsende mit 25 % KESt belastet.";
}

[initialAmount, endValue, cashflowAmount, recurringAmount].forEach((input) => {
  input?.addEventListener("blur", () => formatAmountInput(input));
});

form?.addEventListener("input", clearCalculation);
form?.addEventListener("change", clearCalculation);

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
      note: cashflowNote.value
    });
    cashflowAmount.value = "";
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

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearCalculation();
  formatAmountInput(initialAmount);
  formatAmountInput(endValue);

  try {
    const calc = buildCalculation();
    const xirrResult = calculateXirr(calc.investorFlows);
    renderCoreResults(calc, xirrResult);

    if (historicalCompare.value === "overnight") {
      try {
        const apiData = await fetchSavingsRates(calc.startDate, calc.finishDate);
        const expectedStartMonth = monthFromDate(calc.startDate);
        const expectedEndMonth = monthFromDate(calc.finishDate);
        if (apiData.first_period > expectedStartMonth || apiData.last_period < expectedEndMonth) {
          throw new Error(`ECB-Daten decken den Zeitraum nicht vollständig ab (${apiData.first_period} bis ${apiData.last_period}).`);
        }
        const savings = simulateHistoricalSavings({
          cashflows: calc.benchmarkFlows,
          endDate: calc.finishDate,
          observations: apiData.observations,
          taxPercent: 25
        });
        renderSavings(calc, apiData, savings);
      } catch (error) {
        showWarning(`Fondsrendite wurde berechnet. Historischer Sparvergleich nicht möglich: ${error.message || error}`);
      }
    }
  } catch (error) {
    showError(error.message || "Berechnung nicht möglich.");
  }
});

renderCashflows();
