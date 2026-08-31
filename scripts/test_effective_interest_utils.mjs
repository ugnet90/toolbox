import assert from "node:assert/strict";
import { calculateEffectiveInterest } from "../docs/js/effective-interest-utils.js";

const insurance = calculateEffectiveInterest({
  depositAmount: 100000,
  payoutAmount: 120000,
  termValue: 10,
  termUnit: "Y",
  kestPercent: 0,
  insuranceTaxPercent: 4,
  startDate: "2026-08-31"
});

assert.ok(Math.abs(insurance.netInvestment - (100000 / 1.04)) < 1e-8);
assert.ok(Math.abs(insurance.insuranceTaxAmount - (100000 - 100000 / 1.04)) < 1e-8);
assert.equal(insurance.kestAmount, 0);
assert.equal(insurance.netPayout, 120000);
assert.ok(insurance.totalNetReturn > 0.1999 && insurance.totalNetReturn < 0.2001);
assert.ok(insurance.annualizedNetReturn > 0.0183 && insurance.annualizedNetReturn < 0.0185);
assert.ok(insurance.bankRate > 0);
assert.equal(insurance.taxCombinationWarning, false);

const taxable275 = calculateEffectiveInterest({
  depositAmount: 100000,
  payoutAmount: 114500,
  termValue: 5,
  termUnit: "Y",
  kestPercent: 27.5,
  insuranceTaxPercent: 0,
  startDate: "2026-08-31"
});

assert.equal(taxable275.netPayout, 114500);
assert.ok(Math.abs(taxable275.grossGainBeforeKest - 20000) < 1e-8);
assert.ok(Math.abs(taxable275.kestAmount - 5500) < 1e-8);
assert.ok(taxable275.annualizedNetReturn > 0.0274 && taxable275.annualizedNetReturn < 0.0275);

const taxable25 = calculateEffectiveInterest({
  depositAmount: 100000,
  payoutAmount: 115000,
  termValue: 5,
  termUnit: "Y",
  kestPercent: 25,
  insuranceTaxPercent: 0,
  startDate: "2026-08-31"
});

assert.ok(Math.abs(taxable25.grossGainBeforeKest - 20000) < 1e-8);
assert.ok(Math.abs(taxable25.kestAmount - 5000) < 1e-8);
assert.equal(taxable25.netPayout, 115000);

const unusualCombination = calculateEffectiveInterest({
  depositAmount: 100000,
  payoutAmount: 120000,
  termValue: 10,
  termUnit: "Y",
  kestPercent: 25,
  insuranceTaxPercent: 4,
  startDate: "2026-08-31"
});
assert.equal(unusualCombination.taxCombinationWarning, true);

const loss = calculateEffectiveInterest({
  depositAmount: 100000,
  payoutAmount: 95000,
  termValue: 1,
  termUnit: "Y",
  kestPercent: 27.5,
  insuranceTaxPercent: 0,
  startDate: "2026-08-31"
});
assert.equal(loss.kestAmount, 0);
assert.equal(loss.netPayout, 95000);
assert.ok(loss.totalNetReturn < 0);
assert.equal(loss.bankRateNotRequired, true);

console.log("OK: Effektivzins- und Vergleichslogik getestet.");
