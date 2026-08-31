import assert from "node:assert/strict";
import {
  bankNetFactor,
  bundesschatzNetFactor,
  calculateComparison,
  chooseValueDate,
  days360,
  maturityDate,
  normalizeProducts,
  productsForValueDate,
  solveBankRate
} from "../docs/js/bundesschatz-utils.js";

const payload = {
  data: [
    {
      productDisplayInfo: { productKey: "1M", periodInterval: "M", periodValue: 1, green: false },
      interestRates: [
        { date: "2026-08-31", interestRate: 2.2 },
        { date: "2026-09-01", interestRate: 2.21 }
      ]
    },
    {
      productDisplayInfo: { productKey: "3M-GREEN", periodInterval: "M", periodValue: 3, green: true },
      interestRates: [
        { date: "2026-08-31", interestRate: 2.3 },
        { date: "2026-09-01", interestRate: 2.31 }
      ]
    },
    {
      productDisplayInfo: { productKey: "2Y", periodInterval: "Y", periodValue: 2, green: false },
      interestRates: [
        { date: "2026-09-01", interestRate: 2.8 }
      ]
    }
  ]
};

const products = normalizeProducts(payload);
assert.equal(products.length, 3, "Alle dynamisch gelieferten Produkte müssen übernommen werden.");
assert.equal(products[1].label, "3 Monate");
assert.equal(products[1].green, true);

const beforeNoonVienna = new Date("2026-08-31T07:00:00Z"); // 09:00 Europe/Vienna
const afterNoonVienna = new Date("2026-08-31T11:00:00Z"); // 13:00 Europe/Vienna
assert.equal(chooseValueDate(products, beforeNoonVienna), "2026-08-31");
assert.equal(chooseValueDate(products, afterNoonVienna), "2026-09-01");

const augustOffers = productsForValueDate(products, "2026-08-31");
assert.deepEqual(augustOffers.map((item) => item.productKey), ["1M", "3M-GREEN"]);
const septemberOffers = productsForValueDate(products, "2026-09-01");
assert.deepEqual(septemberOffers.map((item) => item.productKey), ["1M", "3M-GREEN", "2Y"]);

assert.equal(maturityDate("2026-01-31", 1, "M"), "2026-02-28");
assert.equal(maturityDate("2024-02-29", 1, "Y"), "2025-02-28");
assert.equal(maturityDate("2026-08-31", 6, "M"), "2027-02-28");

const sixMonth = bundesschatzNetFactor({
  valueDate: "2024-05-06",
  maturityDate: "2024-11-06",
  interestRate: 3.25
});
const expectedGrossSixMonth = 0.0325 * 184 / 365;
assert.ok(Math.abs(sixMonth.grossReturn - expectedGrossSixMonth) < 1e-12);
assert.ok(Math.abs(sixMonth.netReturn - expectedGrossSixMonth * 0.725) < 1e-12);

const tenYear = bundesschatzNetFactor({
  valueDate: "2024-05-06",
  maturityDate: "2034-05-06",
  interestRate: 2.5
});
const expectedGrossTenYear = Math.pow(1.025, 3652 / 365) - 1;
assert.ok(Math.abs(tenYear.grossReturn - expectedGrossTenYear) < 1e-12);

assert.equal(days360("2026-09-01", "2027-01-01"), 120);
assert.equal(days360("2027-01-01", "2027-09-01"), 240);

const knownBankRate = 0.03;
const bankTarget = bankNetFactor(knownBankRate, "2026-09-01", "2030-09-01");
const solvedBankRate = solveBankRate(bankTarget, "2026-09-01", "2030-09-01");
assert.ok(Math.abs(solvedBankRate - knownBankRate) < 1e-10);

const oneMonthComparison = calculateComparison({
  productKey: "1M",
  periodInterval: "M",
  periodValue: 1,
  green: false,
  label: "1 Monat",
  valueDate: "2026-08-31",
  interestRate: 2.2
});
assert.equal(oneMonthComparison.maturityDate, "2026-09-30");
assert.ok(oneMonthComparison.bankRate > 0.0209 && oneMonthComparison.bankRate < 0.0211);
assert.ok(Math.abs(oneMonthComparison.bankFactor - oneMonthComparison.bundesschatz.factor) < 1e-12);

console.log("OK: Bundesschatz-Vergleichslogik getestet.");
