import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const modulePath = path.resolve("docs/js/insurance-fund-compare-utils.js");
const moduleSource = await fs.readFile(modulePath, "utf8");
const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`;
const {
  effectiveIssueLoadPercent,
  simulateInsuranceFundComparison,
  createInsuranceFundCompareData,
  normalizeInsuranceFundCompareData,
  suggestReturnScenarios
} = await import(moduleUrl);

function base(overrides = {}) {
  return {
    amount: 100000,
    years: 15,
    grossReturnPercent: 6,
    insuranceTaxPercent: 4,
    insuranceEntryCostPercent: 5,
    insuranceEntryCostYears: 5,
    insuranceAdminPremiumPercent: 0,
    insuranceAdminAssetPercent: 0.3,
    insuranceRiskAnnual: 0,
    age50Plus: false,
    personalTaxPercent: 0,
    insuranceMinimumAmount: 30000,
    issueLoadPercent: 3,
    issueLoadDiscountPercent: 100,
    depotFeePercent: 0.2,
    depotFeeAnnual: 0,
    capitalGainsTaxPercent: 27.5,
    directTaxMode: "simple",
    annualTaxableYieldPercent: 2,
    ...overrides
  };
}

assert.equal(effectiveIssueLoadPercent(3, 100), 0);
assert.equal(effectiveIssueLoadPercent(3, 50), 1.5);

{
  const result = simulateInsuranceFundComparison(base({
    amount: 10000,
    insuranceMinimumAmount: 0,
    insuranceTaxPercent: 0,
    insuranceEntryCostPercent: 0,
    insuranceAdminPremiumPercent: 0,
    insuranceAdminAssetPercent: 0,
    issueLoadPercent: 0,
    issueLoadDiscountPercent: 0,
    depotFeePercent: 0,
    capitalGainsTaxPercent: 0,
    years: 10
  }));
  assert.ok(Math.abs(result.insurance.endValue - result.direct.endValue) < 0.01, "Ohne Unterschiede müssen beide Wege gleich sein.");
}

{
  const result = simulateInsuranceFundComparison(base({ years: 1 }));
  const expectedNetPremium = 100000 / 1.04;
  assert.ok(Math.abs(result.insurance.initialNetPremium - expectedNetPremium) < 0.01);
  assert.ok(Math.abs(result.insurance.totalEntryCost - expectedNetPremium * 0.05) < 0.01);
  assert.ok(Math.abs(result.insurance.entryCostPerYear - expectedNetPremium * 0.01) < 0.01, "5 % Abschlusskosten müssen auf 5 Jahre verteilt sein.");
  assert.equal(result.insurance.earlyExit, true);
  assert.ok(result.insurance.additionalInsuranceTax > 0, "Vor 15 Jahren muss die zusätzliche VSt modelliert werden.");
}

{
  const expectedNetPremium = 100000 / 1.04;
  const result = simulateInsuranceFundComparison(base({
    years: 1,
    insuranceEntryCostPercent: 0,
    insuranceAdminPremiumPercent: 0.15,
    insuranceAdminAssetPercent: 0.10
  }));
  assert.ok(Math.abs(result.insurance.adminPremiumCostPerYear - expectedNetPremium * 0.0015) < 0.01, "0,15 % der Netto-Einmalprämie muss als jährliche Verwaltungskomponente wirken.");
  assert.ok(result.insurance.adminPremiumCosts > 0);
  assert.ok(result.insurance.adminAssetCosts > 0);
  assert.ok(Math.abs(result.insurance.adminCosts - (result.insurance.adminPremiumCosts + result.insurance.adminAssetCosts)) < 0.01);
}

{
  const result = simulateInsuranceFundComparison(base({ age50Plus: true, years: 10 }));
  assert.equal(result.inputs.minimumTaxYears, 10);
  assert.equal(result.insurance.additionalInsuranceTax, 0);
  assert.equal(result.insurance.earlyExit, false);
}

{
  const result = simulateInsuranceFundComparison(base({
    amount: 10000,
    insuranceMinimumAmount: 0,
    issueLoadPercent: 3,
    issueLoadDiscountPercent: 0,
    capitalGainsTaxPercent: 0,
    grossReturnPercent: 0,
    depotFeePercent: 0
  }));
  assert.ok(Math.abs(result.direct.initialInvestment - 10000 / 1.03) < 0.01);
  assert.ok(Math.abs(result.direct.issueLoadCost - (10000 - 10000 / 1.03)) < 0.01);
}

{
  const simple = simulateInsuranceFundComparison(base({ directTaxMode: "simple" }));
  const advanced = simulateInsuranceFundComparison(base({ directTaxMode: "annual_proxy", annualTaxableYieldPercent: 2 }));
  assert.ok(advanced.direct.annualTaxes > 0);
  assert.ok(advanced.direct.endValue < simple.direct.grossValue, "Unterjährige Steuer muss Vermögen reduzieren.");
}

{
  assert.throws(() => simulateInsuranceFundComparison(base({ amount: 29999 })), /Mindest-Einmalprämie/);
}

{
  const inputs = base({ product: "ergo_investment", fundName: "Testfonds", fundIsin: "DE0008491051" });
  const payload = createInsuranceFundCompareData({ inputs, toolboxVersion: "0.7.2", exportedAt: "2026-09-11T00:00:00Z" });
  const normalized = normalizeInsuranceFundCompareData(payload);
  assert.equal(payload.schema_version, 3);
  assert.equal(normalized.inputs.product, "ergo_investment");
  assert.equal(normalized.inputs.fundIsin, "DE0008491051");
}

{
  const legacyV1 = {
    format: "toolbox-insurance-fund-compare",
    schema_version: 1,
    inputs: { ...base({ insuranceAdminPremiumPercent: undefined, insuranceAdminAssetPercent: undefined }), insuranceAdminPercent: 0.2, fundCostPercent: 1 }
  };
  delete legacyV1.inputs.insuranceAdminPremiumPercent;
  delete legacyV1.inputs.insuranceAdminAssetPercent;
  const normalized = normalizeInsuranceFundCompareData(legacyV1);
  assert.equal(normalized.inputs.fundCostPercent, undefined);
  assert.equal(normalized.inputs.insuranceAdminPremiumPercent, 0);
  assert.equal(normalized.inputs.insuranceAdminAssetPercent, 0.2);
  assert.equal(normalized.inputs.insuranceAdminPercent, undefined);
}

{
  const legacyV2 = {
    format: "toolbox-insurance-fund-compare",
    schema_version: 2,
    inputs: { ...base({ insuranceAdminPremiumPercent: undefined, insuranceAdminAssetPercent: undefined }), insuranceAdminPercent: 0.3 }
  };
  delete legacyV2.inputs.insuranceAdminPremiumPercent;
  delete legacyV2.inputs.insuranceAdminAssetPercent;
  const normalized = normalizeInsuranceFundCompareData(legacyV2);
  assert.equal(normalized.inputs.insuranceAdminAssetPercent, 0.3);
}

{
  assert.deepEqual(suggestReturnScenarios(6.12), [5, 6, 6.12, 7, 8]);
  assert.deepEqual(suggestReturnScenarios(6), [4, 5, 6, 7, 8]);
}

{
  const result = simulateInsuranceFundComparison(base({
    amount: 10000, insuranceMinimumAmount: 0, insuranceTaxPercent: 0, insuranceEntryCostPercent: 0,
    insuranceAdminPremiumPercent: 0, insuranceAdminAssetPercent: 0, issueLoadPercent: 0,
    issueLoadDiscountPercent: 0, depotFeePercent: 0, capitalGainsTaxPercent: 0, years: 1, grossReturnPercent: 6
  }));
  assert.ok(Math.abs(result.insurance.endValue - 10600) < 0.01, "6 % Fondsrendite müssen ohne zusätzlichen Fondskostenabzug als 6 % wirken.");
  assert.ok(!("fundCosts" in result.insurance));
}

console.log("insurance fund comparison tests: ok");
