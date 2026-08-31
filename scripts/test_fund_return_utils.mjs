import assert from "node:assert/strict";
import {
  calculateXirr,
  generateRecurringDates,
  initialInvestment,
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

console.log("OK: fund return utils");
