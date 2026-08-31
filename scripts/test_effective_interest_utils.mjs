import assert from "node:assert/strict";
import {
  calculateEffectiveInterest,
  commercialRoundPercent
} from "../docs/js/effective-interest-utils.js";

assert.equal(commercialRoundPercent(0.024522), 2.45);
assert.equal(commercialRoundPercent(0.02455), 2.46);

// Netto-Auszahlung: Steuersätze werden bewusst ignoriert.
const net = calculateEffectiveInterest({
  depositAmount: 100000,
  payoutAmount: 120000,
  payoutMode: "net",
  termValue: 10,
  termUnit: "Y",
  kestPercent: 27.5,
  insuranceTaxPercent: 11,
  startDate: "2026-08-31"
});

assert.equal(net.kestRate, 0);
assert.equal(net.insuranceTaxRate, 0);
assert.equal(net.insuranceTaxAmount, 0);
assert.equal(net.netInvestment, 100000);
assert.equal(net.kestAmount, 0);
assert.equal(net.netPayout, 120000);
assert.ok(net.totalNetReturn > 0.1999 && net.totalNetReturn < 0.2001);
assert.ok(net.annualizedNetReturn > 0.0183 && net.annualizedNetReturn < 0.0185);
assert.ok(net.bankRate > 0);
assert.equal(net.taxCombinationWarning, false);

// Brutto-Auszahlung mit Versicherungssteuer, aber ohne KESt.
const grossInsurance = calculateEffectiveInterest({
  depositAmount: 100000,
  payoutAmount: 120000,
  payoutMode: "gross",
  termValue: 10,
  termUnit: "Y",
  kestPercent: 0,
  insuranceTaxPercent: 11,
  startDate: "2026-08-31"
});

assert.ok(Math.abs(grossInsurance.netInvestment - (100000 / 1.11)) < 1e-8);
assert.ok(Math.abs(grossInsurance.insuranceTaxAmount - (100000 - 100000 / 1.11)) < 1e-8);
assert.equal(grossInsurance.kestAmount, 0);
assert.equal(grossInsurance.netPayout, 120000);

// Brutto-Auszahlung mit 27,5 % KESt: KESt wird auf positiven Ertrag
// gegenüber dem netto veranlagten Betrag gerechnet.
const grossTaxable = calculateEffectiveInterest({
  depositAmount: 100000,
  payoutAmount: 120000,
  payoutMode: "gross",
  termValue: 5,
  termUnit: "Y",
  kestPercent: 27.5,
  insuranceTaxPercent: 0,
  startDate: "2026-08-31"
});

assert.equal(grossTaxable.netInvestment, 100000);
assert.equal(grossTaxable.grossGainBeforeKest, 20000);
assert.equal(grossTaxable.kestAmount, 5500);
assert.equal(grossTaxable.netPayout, 114500);

const unusualCombination = calculateEffectiveInterest({
  depositAmount: 100000,
  payoutAmount: 120000,
  payoutMode: "gross",
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
  payoutMode: "net",
  termValue: 1,
  termUnit: "Y",
  kestPercent: 0,
  insuranceTaxPercent: 0,
  startDate: "2026-08-31"
});
assert.equal(loss.kestAmount, 0);
assert.equal(loss.netPayout, 95000);
assert.ok(loss.totalNetReturn < 0);
assert.equal(loss.bankRateNotRequired, true);

console.log("OK: Effektivzins-, Brutto/Netto- und Rundungslogik getestet.");
