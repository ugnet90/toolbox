import assert from "node:assert/strict";
import {
  calculateInterest,
  interestPeriod
} from "../docs/js/interest-calculator-utils.js";

const act360 = interestPeriod("2026-01-01", "2026-02-01", "ACT_360");
assert.equal(act360.days, 31);
assert.equal(act360.denominator, 360);
assert.ok(Math.abs(act360.yearFraction - 31 / 360) < 1e-12);

const act365 = interestPeriod("2026-01-01", "2026-02-01", "ACT_365");
assert.equal(act365.days, 31);
assert.equal(act365.denominator, 365);
assert.ok(Math.abs(act365.yearFraction - 31 / 365) < 1e-12);

const commercial = interestPeriod("2026-01-15", "2026-02-15", "30_360");
assert.equal(commercial.days, 30);
assert.equal(commercial.denominator, 360);

const withOverdraft = calculateInterest({
  debitRatePercent: 7,
  overdraftRatePercent: 5,
  limitAmount: 10000,
  amount: 15000,
  startDate: "2026-01-15",
  endDate: "2026-02-15",
  calculationMethod: "30_360"
});
assert.equal(withOverdraft.overdraftAmount, 5000);
assert.ok(Math.abs(withOverdraft.debitInterest - 87.5) < 1e-10);
assert.ok(Math.abs(withOverdraft.overdraftInterest - (5000 * 0.05 * 30 / 360)) < 1e-10);
assert.ok(Math.abs(withOverdraft.totalInterest - (withOverdraft.debitInterest + withOverdraft.overdraftInterest)) < 1e-10);

const withinLimit = calculateInterest({
  debitRatePercent: 6,
  overdraftRatePercent: 5,
  limitAmount: 20000,
  amount: 15000,
  startDate: "2026-03-01",
  endDate: "2026-04-01",
  calculationMethod: "ACT_360"
});
assert.equal(withinLimit.overdraftAmount, 0);
assert.equal(withinLimit.overdraftInterest, 0);
assert.ok(Math.abs(withinLimit.debitInterest - (15000 * 0.06 * 31 / 360)) < 1e-10);

const sameDay = calculateInterest({
  debitRatePercent: 6,
  overdraftRatePercent: 5,
  limitAmount: 10000,
  amount: 15000,
  startDate: "2026-03-01",
  endDate: "2026-03-01",
  calculationMethod: "ACT_360"
});
assert.equal(sameDay.days, 0);
assert.equal(sameDay.totalInterest, 0);

assert.throws(() => interestPeriod("2026-02-02", "2026-02-01", "ACT_360"), /nicht vor/);
assert.throws(() => interestPeriod("2026-02-01", "2026-02-02", "BAD"), /Berechnungsart/);
assert.throws(() => calculateInterest({
  debitRatePercent: -1,
  overdraftRatePercent: 5,
  limitAmount: 10000,
  amount: 15000,
  startDate: "2026-03-01",
  endDate: "2026-04-01",
  calculationMethod: "ACT_360"
}), /Sollzinssatz/);

console.log("OK: Zinsrechner für act/360, act/365, 30/360 und Überziehungszinsen getestet.");
