import assert from "node:assert/strict";
import { calculateEffectiveInterest } from "../docs/js/effective-interest-utils.js";

const taxFree = calculateEffectiveInterest({
  depositAmount: 100000,
  payoutAmount: 120000,
  termValue: 10,
  termUnit: "Y",
  kestFree: true,
  insuranceTaxPercent: 4,
  startDate: "2026-08-31"
});

assert.equal(taxFree.insuranceTaxAmount, 4000);
assert.equal(taxFree.totalOutlay, 104000);
assert.equal(taxFree.kestAmount, 0);
assert.equal(taxFree.netPayout, 120000);
assert.ok(taxFree.totalNetReturn > 0.1538 && taxFree.totalNetReturn < 0.1539);
assert.ok(taxFree.annualizedNetReturn > 0.0144 && taxFree.annualizedNetReturn < 0.0145);
assert.ok(taxFree.bankRate > 0);

const taxable = calculateEffectiveInterest({
  depositAmount: 100000,
  payoutAmount: 120000,
  termValue: 5,
  termUnit: "Y",
  kestFree: false,
  insuranceTaxPercent: 0,
  startDate: "2026-08-31"
});

assert.equal(taxable.taxableGain, 20000);
assert.equal(taxable.kestAmount, 5500);
assert.equal(taxable.netPayout, 114500);
assert.ok(taxable.annualizedNetReturn > 0.0274 && taxable.annualizedNetReturn < 0.0275);

const loss = calculateEffectiveInterest({
  depositAmount: 100000,
  payoutAmount: 100000,
  termValue: 1,
  termUnit: "Y",
  kestFree: true,
  insuranceTaxPercent: 11,
  startDate: "2026-08-31"
});
assert.equal(loss.kestAmount, 0);
assert.ok(loss.totalNetReturn < 0);
assert.equal(loss.bankRateNotRequired, true);

console.log("OK: Effektivzins- und Vergleichslogik getestet.");
