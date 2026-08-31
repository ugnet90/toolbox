import assert from "node:assert/strict";
import {
  calculateXirr,
  generateRecurringDates,
  initialInvestment,
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
  taxPercent: 0,
  seriesLabel: "3-Monats-Euribor-Daten"
});
assert.ok(Math.abs(euriborBenchmark.grossInterest - expectedGrossInterest) < 1e-6);
assert.equal(euriborBenchmark.tax, 0);
assert.ok(Math.abs(euriborBenchmark.balance - (1000 + expectedGrossInterest)) < 1e-6);

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

console.log("OK: fund return utils");
