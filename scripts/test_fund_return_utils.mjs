import assert from "node:assert/strict";
import {
  applyKestExemption,
  calculateXirr,
  createFundReturnData,
  detectRecurringSavingsPlans,
  generateRecurringDates,
  initialInvestment,
  normalizeFundReturnData,
  parseBankTransactionsCsv,
  simulateHistoricalRateBenchmark,
  simulateHistoricalSavings
} from "../docs/js/fund-return-utils.js";

const gross = initialInvestment({ amount: 1040, amountMode: "gross", purchaseFeePercent: 4 });
assert.ok(Math.abs(gross.netInvested - 1000) < 1e-9);
assert.ok(Math.abs(gross.feeAmount - 40) < 1e-9);
assert.ok(Math.abs(gross.customerOutflow - 1040) < 1e-9);

const net = initialInvestment({ amount: 1000, amountMode: "net", purchaseFeePercent: 4 });
assert.ok(Math.abs(net.customerOutflow - 1040) < 1e-9);
assert.ok(Math.abs(net.netInvested - 1000) < 1e-9);

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
    endDate: "2026-08-31",
    endValue: 77500,
    benchmarkKinds: ["overnight", "euribor3m", "euribor6m"],
    kestExemption: "no"
  },
  cashflows: [
    { date: "2021-01-15", type: "distribution", amount: 250, title: "Fonds XY", note: "Ausschüttung" },
    { date: "2022-02-01", type: "fee", amount: -20, title: "", note: "Depotgebühr" }
  ]
});
assert.equal(exportedData.format, "toolbox-depot-return");
assert.equal(exportedData.schema_version, 2);
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
assert.equal(normalizedLegacy.cashflows[0].title, "");

assert.throws(
  () => normalizeFundReturnData({ ...exportedData, format: "other" }),
  /keine unterstützte Toolbox-Depotrendite-Datei/
);

const bankCsv = [
  "ISIN;Titel;Menge;Einheit;Abrechnungsbetrag;Währung;Stichtag;Geschäftsart;Abrechnungsnummer;Abrechnungsdatum;Ausführungsnummer;Ausführungsdatum",
  "DE0008491051;UNIGLOBAL ANTEILSSCH.KL.;0,467;Stk;-249,65;EUR;12.08.2026;Kauf aus Dauerauftrag;75273135;17.08.2026;75938106;14.08.2026",
  "DE0008491051;UNIGLOBAL ANTEILSSCH.KL.;0;Stk;0,00;EUR;12.09.2026;Kauf aus Dauerauftrag;75273136;17.09.2026;75938107;14.09.2026",
  ";;;;;;;;;;;"
].join("\r\n");
const importedBankCsv = parseBankTransactionsCsv(bankCsv);
assert.equal(importedBankCsv.cashflows.length, 1);
assert.equal(importedBankCsv.skippedZeroAmounts, 1);
assert.deepEqual(importedBankCsv.cashflows[0], {
  date: "2026-08-17",
  type: "contribution",
  amount: -249.65,
  title: "UNIGLOBAL ANTEILSSCH.KL.",
  note: "Kauf aus Dauerauftrag"
});
assert.equal(importedBankCsv.unknownBusinessTypes, 0);
assert.equal(importedBankCsv.hasTitleColumn, true);

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

console.log("OK: fund return utils");
