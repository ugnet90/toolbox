import assert from "node:assert/strict";
import {
  applyKestExemption,
  calculateXirr,
  createFundReturnData,
  detectRecurringSavingsPlans,
  generateRecurringDates,
  initialInvestment,
  mergeDateRanges,
  missingDateRanges,
  buildDepotHistory,
  buildBenchmarkHistory,
  normalizeFundReturnData,
  parseBankTransactionsCsv,
  simulateHistoricalRateBenchmark,
  simulateHistoricalSavings,
  summarizeCsvPurchaseFees
} from "../docs/js/fund-return-utils.js";

const gross = initialInvestment({ amount: 1040, amountMode: "gross", purchaseFeePercent: 4 });
assert.ok(Math.abs(gross.netInvested - 1000) < 1e-9);
assert.ok(Math.abs(gross.feeAmount - 40) < 1e-9);
assert.ok(Math.abs(gross.customerOutflow - 1040) < 1e-9);

const net = initialInvestment({ amount: 1000, amountMode: "net", purchaseFeePercent: 4 });
assert.ok(Math.abs(net.customerOutflow - 1040) < 1e-9);
assert.ok(Math.abs(net.netInvested - 1000) < 1e-9);

const zeroStart = initialInvestment({ amount: 0, amountMode: "gross", purchaseFeePercent: 4 });
assert.equal(zeroStart.customerOutflow, 0);
assert.equal(zeroStart.netInvested, 0);
assert.equal(zeroStart.feeAmount, 0);

const zeroStartXirr = calculateXirr([
  { date: "2020-01-01", amount: 0 },
  { date: "2020-02-01", amount: -100 },
  { date: "2021-02-01", amount: 110 }
]);
assert.ok(Number.isFinite(zeroStartXirr.rate));

assert.deepEqual(
  generateRecurringDates({ firstDate: "2024-01-31", lastDate: "2024-04-30", intervalMonths: 1 }),
  ["2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30"]
);

const xirr = calculateXirr([
  { date: "2020-01-01", amount: -1000 },
  { date: "2021-01-01", amount: 1100 }
]);
const expectedLeapXirr = Math.pow(1.1, 365 / 366) - 1;
assert.ok(Math.abs(xirr.rate - expectedLeapXirr) < 1e-8);
assert.equal(xirr.rootCount, 1);

const observations = [];
for (let month = 1; month <= 12; month += 1) {
  observations.push({ period: `2020-${String(month).padStart(2, "0")}`, rate: 12 });
}
const savings = simulateHistoricalSavings({
  cashflows: [{ date: "2020-01-01", amount: -1000 }],
  endDate: "2021-01-01",
  observations,
  taxPercent: 25
});
const expectedGrossInterest = 1000 * 0.12 * (366 / 365);
const expectedTax = expectedGrossInterest * 0.25;
assert.ok(Math.abs(savings.grossInterest - expectedGrossInterest) < 1e-6);
assert.ok(Math.abs(savings.tax - expectedTax) < 1e-6);
assert.ok(Math.abs(savings.balance - (1000 + expectedGrossInterest - expectedTax)) < 1e-6);

const euriborBenchmark = simulateHistoricalRateBenchmark({
  cashflows: [{ date: "2020-01-01", amount: -1000 }],
  endDate: "2021-01-01",
  observations,
  taxPercent: 25,
  seriesLabel: "3-Monats-Euribor-Daten"
});
assert.ok(Math.abs(euriborBenchmark.grossInterest - expectedGrossInterest) < 1e-6);
assert.ok(Math.abs(euriborBenchmark.tax - expectedTax) < 1e-6);
assert.ok(Math.abs(euriborBenchmark.balance - (1000 + expectedGrossInterest - expectedTax)) < 1e-6);

const euriborExempt = simulateHistoricalRateBenchmark({
  cashflows: [{ date: "2020-01-01", amount: -1000 }],
  endDate: "2021-01-01",
  observations,
  taxPercent: 0,
  seriesLabel: "3-Monats-Euribor-Daten"
});
assert.equal(euriborExempt.tax, 0);
assert.ok(Math.abs(euriborExempt.balance - (1000 + expectedGrossInterest)) < 1e-6);

const negativeBenchmark = simulateHistoricalRateBenchmark({
  cashflows: [{ date: "2020-01-01", amount: -1000 }],
  endDate: "2020-02-01",
  observations: [{ period: "2020-01", rate: -1 }],
  taxPercent: 0,
  seriesLabel: "3-Monats-Euribor-Daten"
});
assert.ok(negativeBenchmark.balance < 1000);
assert.equal(negativeBenchmark.tax, 0);

assert.throws(
  () => simulateHistoricalSavings({
    cashflows: [
      { date: "2020-01-01", amount: -100 },
      { date: "2020-02-01", amount: 200 }
    ],
    endDate: "2020-03-01",
    observations,
    taxPercent: 25
  }),
  /ins Minus/
);

const trailingObservations = [
  { period: "2020-01", rate: 6 },
  { period: "2020-02", rate: 12 }
];
const carriedSavings = simulateHistoricalSavings({
  cashflows: [{ date: "2020-01-01", amount: -1000 }],
  endDate: "2020-04-01",
  observations: trailingObservations,
  taxPercent: 25
});
assert.equal(carriedSavings.rateCoverage.carriedForward, true);
assert.equal(carriedSavings.rateCoverage.lastOfficialPeriod, "2020-02");
assert.equal(carriedSavings.rateCoverage.requiredEndPeriod, "2020-04");
assert.equal(carriedSavings.rateCoverage.carriedRate, 12);

assert.throws(
  () => simulateHistoricalSavings({
    cashflows: [{ date: "2020-01-01", amount: -1000 }],
    endDate: "2020-04-01",
    observations: [
      { period: "2020-01", rate: 6 },
      { period: "2020-03", rate: 12 }
    ],
    taxPercent: 25
  }),
  /innerhalb der ECB-Datenreihe/
);

const kestFlows = [
  { date: "2024-01-01", amount: -1000, type: "contribution" },
  { date: "2024-06-01", amount: -75, type: "tax" },
  { date: "2024-12-31", amount: 1200, type: "distribution" }
];
const notExempt = applyKestExemption(kestFlows, false);
assert.equal(notExempt.cashflows.length, 3);
assert.equal(notExempt.ignoredTaxCashflows.length, 0);

const exempt = applyKestExemption(kestFlows, true);
assert.equal(exempt.cashflows.length, 2);
assert.equal(exempt.ignoredTaxCashflows.length, 1);
assert.equal(exempt.ignoredTaxNet, -75);
assert.ok(exempt.cashflows.every((flow) => flow.type !== "tax"));


const exportedData = createFundReturnData({
  toolboxVersion: "0.5.0",
  exportedAt: "2026-09-01T12:00:00.000Z",
  inputs: {
    designation: "Depot Test",
    purchaseDate: "2020-01-01",
    initialAmount: 50000,
    initialAmountMode: "gross",
    purchaseFeePercent: 2,
    recurringPurchaseFeePercent: 0.5,
    recurringAmountMode: "net",
    endDate: "2026-08-31",
    endValue: 77500,
    benchmarkKinds: ["overnight", "euribor3m", "euribor6m"],
    kestExemption: "no"
  },
  cashflows: [
    { date: "2021-01-15", type: "distribution", amount: 250, title: "Fonds XY", note: "Ausschüttung", isin: "", quantity: null, unit: "" },
    { date: "2022-02-01", type: "fee", amount: -20, title: "", note: "Depotgebühr", isin: "", quantity: null, unit: "" }
  ]
});
assert.equal(exportedData.format, "toolbox-depot-return");
assert.equal(exportedData.schema_version, 5);
assert.equal(exportedData.inputs.designation, "Depot Test");
assert.deepEqual(exportedData.inputs.benchmarkKinds, ["overnight", "euribor3m", "euribor6m"]);
assert.equal(exportedData.cashflows[0].title, "Fonds XY");

const importedData = normalizeFundReturnData(exportedData);
assert.deepEqual(importedData.inputs, exportedData.inputs);
assert.deepEqual(importedData.cashflows, exportedData.cashflows);

// Alte v1-Exporte bleiben importierbar.
const legacyData = {
  format: "toolbox-fund-return",
  schema_version: 1,
  inputs: {
    purchaseDate: "2020-01-01",
    initialAmount: 50000,
    initialAmountMode: "gross",
    purchaseFeePercent: 2,
    endDate: "2026-08-31",
    endValue: 77500,
    historicalCompare: "both",
    kestExemption: "no"
  },
  cashflows: [{ date: "2021-01-15", type: "distribution", amount: 250, note: "Ausschüttung" }]
};
const normalizedLegacy = normalizeFundReturnData(legacyData);
assert.deepEqual(normalizedLegacy.inputs.benchmarkKinds, ["overnight", "euribor3m"]);
assert.equal(normalizedLegacy.inputs.recurringPurchaseFeePercent, 0);
assert.equal(normalizedLegacy.inputs.recurringAmountMode, "gross");
assert.equal(normalizedLegacy.cashflows[0].title, "");

const zeroStartPayload = JSON.parse(JSON.stringify(exportedData));
zeroStartPayload.inputs.initialAmount = 0;
assert.equal(normalizeFundReturnData(zeroStartPayload).inputs.initialAmount, 0);

assert.throws(
  () => normalizeFundReturnData({ ...exportedData, format: "other" }),
  /keine unterstützte Toolbox-Depotrendite-Datei/
);

const bankCsv = [
  "ISIN;Titel;Menge;Einheit;Abrechnungsbetrag;Währung;Stichtag;Rechenwert;Geschäftsart;Abrechnungsnummer;Abrechnungsdatum;Ausführungsnummer;Ausführungsdatum",
  "DE0008491051;UNIGLOBAL ANTEILSSCH.KL.;0,467;Stk;-249,65;EUR;12.08.2026;524,10;Kauf aus Dauerauftrag;75273135;17.08.2026;75938106;14.08.2026",
  "DE0008491051;UNIGLOBAL ANTEILSSCH.KL.;0;Stk;0,00;EUR;12.09.2026;524,10;Kauf aus Dauerauftrag;75273136;17.09.2026;75938107;14.09.2026",
  ";;;;;;;;;;;;"
].join("\r\n");
const importedBankCsv = parseBankTransactionsCsv(bankCsv);
assert.equal(importedBankCsv.cashflows.length, 1);
assert.equal(importedBankCsv.skippedZeroAmounts, 1);
assert.equal(importedBankCsv.earliestTransactionDate, "2026-08-17");
assert.equal(importedBankCsv.suggestedZeroStartDate, null);
assert.deepEqual(importedBankCsv.cashflows[0], {
  date: "2026-08-17",
  type: "contribution",
  amount: -249.65,
  title: "UNIGLOBAL ANTEILSSCH.KL.",
  note: "Kauf aus Dauerauftrag",
  isin: "DE0008491051",
  quantity: 0.467,
  unit: "Stk",
  valuationDate: "2026-08-12",
  referenceValue: 524.10,
  purchaseFeePerUnit: importedBankCsv.cashflows[0].purchaseFeePerUnit,
  purchaseFeeTotal: importedBankCsv.cashflows[0].purchaseFeeTotal,
  purchaseFeePercent: importedBankCsv.cashflows[0].purchaseFeePercent
});
assert.ok(Math.abs(importedBankCsv.cashflows[0].purchaseFeePerUnit - ((249.65 / 0.467) - 524.10)) < 1e-9);
assert.ok(Math.abs(importedBankCsv.cashflows[0].purchaseFeeTotal - (249.65 - (524.10 * 0.467))) < 1e-9);
assert.ok(Math.abs(importedBankCsv.cashflows[0].purchaseFeePercent - ((((249.65 / 0.467) - 524.10) / 524.10) * 100)) < 1e-9);
assert.equal(importedBankCsv.hasValuationDateColumn, true);
assert.equal(importedBankCsv.hasReferenceValueColumn, true);
const purchaseFeeSummary = summarizeCsvPurchaseFees(importedBankCsv.cashflows);
assert.equal(purchaseFeeSummary.length, 1);
assert.equal(purchaseFeeSummary[0].purchases, 1);
assert.ok(Math.abs(purchaseFeeSummary[0].feeTotal - importedBankCsv.cashflows[0].purchaseFeeTotal) < 1e-9);
assert.deepEqual(importedBankCsv.securityIsins, ["DE0008491051"]);
assert.equal(importedBankCsv.hasIsinColumn, true);
assert.equal(importedBankCsv.hasQuantityColumn, true);
assert.equal(importedBankCsv.unknownBusinessTypes, 0);
assert.equal(importedBankCsv.hasTitleColumn, true);


const zeroStandingOrderStartCsv = [
  "ISIN;Titel;Menge;Einheit;Abrechnungsbetrag;Geschäftsart;Abrechnungsdatum",
  "DE0008491051;UNIGLOBAL ANTEILSSCH.KL.;0;Stk;0,00;Kauf aus Dauerauftrag;05.03.2020",
  "DE0008491051;UNIGLOBAL ANTEILSSCH.KL.;0,2;Stk;-100,00;Kauf aus Dauerauftrag;05.04.2020"
].join("\n");
const importedZeroStandingOrderStart = parseBankTransactionsCsv(zeroStandingOrderStartCsv);
assert.equal(importedZeroStandingOrderStart.skippedZeroAmounts, 1);
assert.equal(importedZeroStandingOrderStart.earliestTransactionDate, "2020-03-05");
assert.equal(importedZeroStandingOrderStart.suggestedZeroStartDate, "2020-03-05");
assert.equal(importedZeroStandingOrderStart.cashflows.length, 1);

const unknownCsv = [
  "Abrechnungsbetrag;Geschäftsart;Abrechnungsdatum",
  "12,50;Sonderbuchung;01.02.2025"
].join("\n");
const importedUnknownCsv = parseBankTransactionsCsv(unknownCsv);
assert.equal(importedUnknownCsv.cashflows[0].type, "other");
assert.equal(importedUnknownCsv.cashflows[0].title, "");
assert.equal(importedUnknownCsv.unknownBusinessTypes, 1);
assert.equal(importedUnknownCsv.hasTitleColumn, false);

const plans = detectRecurringSavingsPlans([
  { date: "2025-01-12", type: "contribution", amount: -99.70, title: "Fonds XY" },
  { date: "2025-02-12", type: "contribution", amount: -100.40, title: "Fonds XY" },
  { date: "2025-03-13", type: "contribution", amount: -100.90, title: "Fonds XY" },
  { date: "2025-04-11", type: "contribution", amount: -99.30, title: "Fonds XY" }
]);
assert.equal(plans.length, 1);
assert.equal(plans[0].title, "Fonds XY");
assert.equal(plans[0].nominalAmount, 100);
assert.equal(plans[0].firstDate, "2025-01-12");
assert.equal(plans[0].lastDate, "2025-04-11");


assert.deepEqual(mergeDateRanges([
  { start: "2026-01-01", end: "2026-01-10" },
  { start: "2026-01-11", end: "2026-01-20" },
  { start: "2026-03-01", end: "2026-03-05" }
]), [
  { start: "2026-01-01", end: "2026-01-20" },
  { start: "2026-03-01", end: "2026-03-05" }
]);
assert.deepEqual(missingDateRanges("2026-01-01", "2026-01-31", [
  { start: "2026-01-05", end: "2026-01-20" }
]), [
  { start: "2026-01-01", end: "2026-01-04" },
  { start: "2026-01-21", end: "2026-01-31" }
]);

const depotHistory = buildDepotHistory({
  cashflows: [
    { date: "2026-01-02", type: "contribution", amount: -1000, title: "UniGlobal", isin: "DE0008491051", quantity: 10 },
    { date: "2026-02-02", type: "contribution", amount: -520, isin: "DE0008491051", quantity: 5 },
    { date: "2026-03-02", type: "withdrawal", amount: 630, isin: "DE0008491051", quantity: -5 }
  ],
  pricesByIsin: {
    DE0008491051: {
      currency: "EUR",
      observations: [
        { date: "2026-01-01", redemption_price: 100 },
        { date: "2026-01-02", redemption_price: 101 },
        { date: "2026-02-02", redemption_price: 103 },
        { date: "2026-03-02", redemption_price: 120 },
        { date: "2026-03-31", redemption_price: 125 }
      ]
    }
  },
  endDate: "2026-03-31",
  returnCashflows: [
    { date: "2026-01-02", amount: -1000, type: "contribution" },
    { date: "2026-02-02", amount: -520, type: "contribution" },
    { date: "2026-03-02", amount: 630, type: "withdrawal" }
  ]
});
assert.equal(depotHistory.holdings[0].quantity, 10);
assert.equal(depotHistory.lastValue, 1250);
assert.equal(depotHistory.lastNetInvested, 890);
assert.equal(depotHistory.lastProfit, 360);
assert.equal(depotHistory.points.at(-1).profit, 360);
assert.equal(depotHistory.endDate, "2026-03-31");
assert.equal(depotHistory.funds[0].title, "UniGlobal");
assert.ok(depotHistory.points.some((point) => Number.isFinite(point.depotReturn)));
assert.ok(depotHistory.points.some((point) => Number.isFinite(point.fundReturns.DE0008491051)));
const expectedHistoryReturn = calculateXirr([
  { date: "2026-01-02", amount: -1000 },
  { date: "2026-02-02", amount: -520 },
  { date: "2026-03-02", amount: 630 },
  { date: "2026-03-31", amount: 1250 }
]).rate;
assert.ok(Math.abs(depotHistory.points.at(-1).depotReturn - expectedHistoryReturn) < 1e-7);

const laterFundHistory = buildDepotHistory({
  cashflows: [
    { date: "2026-01-02", type: "contribution", amount: -1000, title: "Fonds A", isin: "DE0008491051", quantity: 10 },
    { date: "2026-08-17", valuationDate: "2026-08-12", type: "contribution", amount: -500, title: "Fonds B", isin: "LU0000000001", quantity: 5 }
  ],
  pricesByIsin: {
    DE0008491051: { observations: [
      { date: "2026-01-02", redemption_price: 100 },
      { date: "2026-08-01", redemption_price: 110 },
      { date: "2026-09-30", redemption_price: 112 }
    ] },
    LU0000000001: { observations: [
      { date: "2026-08-12", redemption_price: 100 },
      { date: "2026-09-30", redemption_price: 105 }
    ] }
  },
  endDate: "2026-09-30"
});
const beforeSecondFund = laterFundHistory.points.filter((point) => point.date < "2026-08-12");
assert.ok(beforeSecondFund.length > 0);
assert.ok(beforeSecondFund.every((point) => point.fundReturns.LU0000000001 === null));

const benchmarkHistory = buildBenchmarkHistory({
  historyPoints: [
    { date: "2020-02-15" },
    { date: "2021-01-01" }
  ],
  cashflows: [{ date: "2020-01-01", amount: -1000 }],
  observations,
  taxPercent: 25,
  seriesLabel: "Testbenchmark"
});
assert.equal(benchmarkHistory.length, 2);
assert.ok(benchmarkHistory[1].value > 1000);
assert.ok(Number.isFinite(benchmarkHistory[1].rate));
const benchmarkFinal = simulateHistoricalRateBenchmark({
  cashflows: [{ date: "2020-01-01", amount: -1000 }],
  endDate: "2021-01-01",
  observations,
  taxPercent: 25,
  seriesLabel: "Testbenchmark"
});
assert.ok(Math.abs(benchmarkHistory.at(-1).value - benchmarkFinal.balance) < 1e-9);

console.log("OK: fund return utils");
