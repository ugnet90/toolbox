import {
  applyKestExemption,
  calculateXirr,
  formatGermanNumber,
  generateRecurringDates,
  initialInvestment,
  parseGermanNumber,
  simulateHistoricalRateBenchmark,
  summarizeCashflows
} from "./fund-return-utils.js";

const DATA_PROXY = "https://toolbox-bundesschatz-proxy.daniel-koechler.workers.dev";
const BENCHMARKS = {
  overnight: {
    endpoint: "/savings-rates",
    label: "Historische Spareinlage",
    differenceLabel: "Fonds vs. Spareinlage",
    interestLabel: "Spareinlagen-Bruttozinsen",
    taxLabel: "KESt Spareinlage",
    taxPercent: 25,
    seriesLabel: "historische Spareinlagen-Zinsen",
    methodText: "Der historische Sparvergleich verwendet die monatliche ECB-MIR-Serie für täglich fällige österreichische Haushaltseinlagen. Der jeweilige Jahreszinssatz wird taggenau (act/365) auf das alternative Sparguthaben angewendet."
  },
  euribor3m: {
    endpoint: "/euribor-3m",
    label: "3-Monats-Euribor",
    differenceLabel: "Fonds vs. 3M-Euribor",
    interestLabel: "Euribor-Bruttozinsen",
    taxLabel: "KESt Euribor-Vergleich",
    taxPercent: 25,
    seriesLabel: "3-Monats-Euribor-Daten",
    methodText: "Der 3-Monats-Euribor-Vergleich verwendet den monatlichen Durchschnitt der offiziellen ECB-Serie FM.M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA. Der jeweilige Jahreszinssatz wird taggenau (act/365) auf ein fiktives Sparguthaben angewendet. Euribor dient dabei nur als Referenzzinssatz; für den Vergleich wird er wie ein Sparprodukt behandelt."
  }
};

const form = document.querySelector("[data-fund-form]");
const errorNode = document.querySelector("[data-fund-error]");
const warningNode = document.querySelector("[data-fund-warning]");
const resultsNode = document.querySelector("[data-fund-results]");
const detailsNode = document.querySelector("[data-fund-details]");
const cashflowBody = document.querySelector("[data-cashflow-body]");
const cashflowTableWrap = document.querySelector("[data-cashflow-table-wrap]");
const ignoredKestDetail = document.querySelector("[data-ignored-kest-detail]");
const comparisonChart = document.querySelector("[data-comparison-chart]");
const valueChart = document.querySelector("[data-value-chart]");
const returnChart = document.querySelector("[data-return-chart]");
const resetButton = document.querySelector("[data-reset-fund]");

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

const purchaseDate = document.querySelector("#purchaseDate");
const initialAmount = document.querySelector("#initialAmount");
const initialAmountMode = document.querySelector("#initialAmountMode");
const purchaseFee = document.querySelector("#purchaseFee");
const endDate = document.querySelector("#endDate");
const endValue = document.querySelector("#endValue");
const historicalCompare = document.querySelector("#historicalCompare");
const kestExemption = document.querySelector("#kestExemption");

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
  if (valueChart) valueChart.innerHTML = "";
  if (returnChart) returnChart.innerHTML = "";
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
    ? " Eine wirksame KESt-Befreiungserklärung wurde angesetzt; als KESt/Steuer auf agE kategorisierte Cashflows werden in der Fondsrendite nicht berücksichtigt. Dies bildet nur den KESt-Abzug ab, nicht Körperschaftsteuer oder andere Steuern."
    : " Eine KESt-Befreiungserklärung wurde nicht angesetzt; erfasste Steuer-Cashflows wirken daher wie eingegeben auf die Fondsrendite.";
  setText(nodes.method, `Die Rendite wird als datumsgenaue XIRR aus allen berücksichtigten Anleger-Cashflows berechnet. Der Start-Cashflow entspricht dem tatsächlichen Kundenaufwand; Kaufspesen beeinflussen daher die Rendite, ohne dass eine vollständige Fondsbesteuerung modelliert wird.${kestMethodText}${multipleRootText}`);
  if (calc.isKestExempt && calc.ignoredKestCashflows.length > 0) {
    appendWarning(`Hinweis: ${calc.ignoredKestCashflows.length} als KESt/Steuer auf agE erfasste Cashflow(s) werden wegen der aktivierten KESt-Befreiung nicht berücksichtigt.`);
  }
  if (xirrResult.rootCount > 1) {
    appendWarning("Hinweis: Für diese Zahlungsstromfolge existieren mehrere mathematisch mögliche Effektivzinssätze. Details beachten.");
  }

  if (resultsNode) resultsNode.hidden = false;
  if (detailsNode) detailsNode.hidden = false;
}

function selectedBenchmarkKinds() {
  const selection = historicalCompare?.value || "both";
  if (selection === "both") return ["overnight", "euribor3m"];
  if (BENCHMARKS[selection]) return [selection];
  return [];
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

function appendSimpleBar(container, label, value, maxValue) {
  if (!container) return;
  const row = document.createElement("div");
  row.className = "comparison-bar-row";
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

function appendReturnBar(container, label, rate, minRate, maxRate) {
  if (!container) return;
  const row = document.createElement("div");
  row.className = "comparison-bar-row comparison-bar-row--return";
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
    { label: "Fonds", value: calc.terminalValue },
    ...benchmarkResults.map((item) => ({ label: item.config.label, value: item.benchmark.balance }))
  ];
  const maxValue = Math.max(...valueItems.map((item) => item.value), 0);
  valueItems.forEach((item) => appendSimpleBar(valueChart, item.label, item.value, maxValue));

  const returnItems = [
    { label: "Fonds", rate: fundXirrResult.rate },
    ...benchmarkResults.map((item) => ({ label: item.config.label, rate: item.xirrResult.rate }))
  ];
  const minRate = Math.min(...returnItems.map((item) => item.rate), 0);
  const maxRate = Math.max(...returnItems.map((item) => item.rate), 0);
  returnItems.forEach((item) => appendReturnBar(returnChart, item.label, item.rate, minRate, maxRate));

  comparisonChart.hidden = false;
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


resetButton?.addEventListener("click", () => {
  form?.reset();
  cashflows = [];
  nextCashflowId = 1;
  renderCashflows();
  clearCalculation();
  purchaseDate?.focus();
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

    const kinds = selectedBenchmarkKinds();
    if (kinds.length) {
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

      if (runRevision !== calculationRevision) return;

      const rendered = [];
      settled.forEach((result, index) => {
        const kind = kinds[index];
        if (result.status === "fulfilled") {
          try {
            rendered.push(renderBenchmark(calc, kind, result.value.config, result.value.apiData, result.value.benchmark, result.value.effectiveTaxPercent));
          } catch (error) {
            appendWarning(`Fondsrendite wurde berechnet. Effektivrendite für „${BENCHMARKS[kind]?.label || kind}“ nicht möglich: ${error.message || error}`);
          }
        } else {
          appendWarning(`Fondsrendite wurde berechnet. Vergleich „${BENCHMARKS[kind]?.label || kind}“ nicht möglich: ${result.reason?.message || result.reason}`);
        }
      });
      renderComparisonCharts(calc, xirrResult, rendered);
    }
  } catch (error) {
    showError(error.message || "Berechnung nicht möglich.");
  }
});

renderCashflows();
