export const INSURANCE_FUND_COMPARE_FORMAT = "toolbox-insurance-fund-compare";
export const INSURANCE_FUND_COMPARE_SCHEMA_VERSION = 1;

const EPS = 1e-9;

function finite(value, label, { min = -Infinity, max = Infinity, integer = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} ist ungültig.`);
  if (integer && !Number.isInteger(number)) throw new Error(`${label} muss ganzzahlig sein.`);
  if (number < min || number > max) throw new Error(`${label} liegt außerhalb des erlaubten Bereichs.`);
  return number;
}

export function effectiveIssueLoadPercent(issueLoadPercent, discountPercent) {
  const issue = finite(issueLoadPercent, "Ausgabeaufschlag", { min: 0, max: 100 });
  const discount = finite(discountPercent, "Rabatt auf Ausgabeaufschlag", { min: 0, max: 100 });
  return issue * (1 - discount / 100);
}

export function annualEffectiveReturn(initialAmount, endValue, years) {
  const initial = finite(initialAmount, "Anlagebetrag", { min: 0.01 });
  const end = finite(endValue, "Endwert", { min: 0 });
  const term = finite(years, "Laufzeit", { min: 1, integer: true });
  if (end <= 0) return -1;
  return Math.pow(end / initial, 1 / term) - 1;
}

function applyFundYear(balance, grossReturnRate, fundCostRate) {
  const opening = balance;
  const grossGain = opening * grossReturnRate;
  let afterReturn = opening + grossGain;
  if (afterReturn < 0) afterReturn = 0;
  const fundCost = afterReturn * fundCostRate;
  const closing = Math.max(0, afterReturn - fundCost);
  return { opening, grossGain, fundCost, closing };
}

function qualifyingMinimumYears(age50Plus) {
  return age50Plus ? 10 : 15;
}

function normalizeInputs(raw = {}) {
  const amount = finite(raw.amount, "Anlagebetrag", { min: 0.01 });
  const years = finite(raw.years, "Laufzeit", { min: 1, max: 60, integer: true });
  const grossReturnPercent = finite(raw.grossReturnPercent, "Fondsrendite", { min: -100, max: 100 });
  const fundCostPercent = finite(raw.fundCostPercent, "Fondskosten", { min: 0, max: 20 });

  const insuranceTaxPercent = finite(raw.insuranceTaxPercent, "Versicherungssteuer", { min: 0, max: 30 });
  const insuranceEntryCostPercent = finite(raw.insuranceEntryCostPercent, "Abschlusskosten", { min: 0, max: 50 });
  const insuranceEntryCostYears = finite(raw.insuranceEntryCostYears, "Verteilung der Abschlusskosten", { min: 1, max: 20, integer: true });
  const insuranceAdminPercent = finite(raw.insuranceAdminPercent, "Versicherungs-Verwaltungskosten", { min: 0, max: 20 });
  const insuranceRiskAnnual = finite(raw.insuranceRiskAnnual ?? 0, "Risikokosten", { min: 0, max: 1_000_000 });
  const age50Plus = Boolean(raw.age50Plus);
  const personalTaxPercent = finite(raw.personalTaxPercent ?? 0, "Persönlicher Einkommensteuersatz", { min: 0, max: 60 });
  const insuranceMinimumAmount = finite(raw.insuranceMinimumAmount ?? 0, "Mindestanlage", { min: 0, max: 10_000_000 });

  const issueLoadPercent = finite(raw.issueLoadPercent, "Ausgabeaufschlag", { min: 0, max: 100 });
  const issueLoadDiscountPercent = finite(raw.issueLoadDiscountPercent, "Rabatt auf Ausgabeaufschlag", { min: 0, max: 100 });
  const depotFeePercent = finite(raw.depotFeePercent, "Depotkosten pro Jahr", { min: 0, max: 20 });
  const depotFeeAnnual = finite(raw.depotFeeAnnual ?? 0, "Fixe Depotkosten", { min: 0, max: 1_000_000 });
  const capitalGainsTaxPercent = finite(raw.capitalGainsTaxPercent ?? 27.5, "KESt-Satz", { min: 0, max: 100 });
  const directTaxMode = String(raw.directTaxMode || "simple");
  if (!new Set(["simple", "annual_proxy"]).has(directTaxMode)) throw new Error("Unbekannter Steuermodus für die Direktanlage.");
  const annualTaxableYieldPercent = directTaxMode === "annual_proxy"
    ? finite(raw.annualTaxableYieldPercent ?? 0, "Jährlich steuerwirksamer Ertrag", { min: 0, max: 100 })
    : 0;

  if (insuranceMinimumAmount > 0 && amount + EPS < insuranceMinimumAmount) {
    throw new Error(`Für das gewählte Versicherungsprodukt beträgt die Mindest-Einmalprämie ${insuranceMinimumAmount.toLocaleString("de-AT")} €.`);
  }

  return {
    amount,
    years,
    grossReturnRate: grossReturnPercent / 100,
    fundCostRate: fundCostPercent / 100,
    insuranceTaxRate: insuranceTaxPercent / 100,
    insuranceEntryCostRate: insuranceEntryCostPercent / 100,
    insuranceEntryCostYears,
    insuranceAdminRate: insuranceAdminPercent / 100,
    insuranceRiskAnnual,
    age50Plus,
    personalTaxRate: personalTaxPercent / 100,
    insuranceMinimumAmount,
    issueLoadPercent,
    issueLoadDiscountPercent,
    depotFeeRate: depotFeePercent / 100,
    depotFeeAnnual,
    capitalGainsTaxRate: capitalGainsTaxPercent / 100,
    directTaxMode,
    annualTaxableYieldRate: annualTaxableYieldPercent / 100
  };
}

function insuranceExitTaxes(balance, year, n) {
  const minYears = qualifyingMinimumYears(n.age50Plus);
  if (year >= minYears || n.insuranceTaxRate >= 0.11 - EPS) {
    return { additionalInsuranceTax: 0, incomeTax: 0, minimumYears: minYears, earlyExit: false };
  }

  // Bei einem Einmalerlag, der zunächst mit 4 % VSt belastet wurde, wird bei frühem
  // Rückkauf grundsätzlich eine zusätzliche VSt von 7 % des Versicherungsentgelts fällig.
  const additionalInsuranceTax = n.insuranceTaxRate > EPS
    ? n.insuranceNetPremium * 0.07
    : 0;
  const taxableDifference = Math.max(0, balance - n.amount);
  const incomeTax = taxableDifference * n.personalTaxRate;
  return { additionalInsuranceTax, incomeTax, minimumYears: minYears, earlyExit: true };
}

function directLiquidation(balance, taxBasis, annualTaxes, n) {
  const taxableGain = Math.max(0, balance - taxBasis);
  const saleTax = taxableGain * n.capitalGainsTaxRate;
  return {
    taxableGain,
    saleTax,
    annualTaxes,
    totalTax: annualTaxes + saleTax,
    netValue: Math.max(0, balance - saleTax)
  };
}

export function simulateInsuranceFundComparison(rawInputs) {
  const n = normalizeInputs(rawInputs);
  const effectiveLoadPercent = effectiveIssueLoadPercent(n.issueLoadPercent, n.issueLoadDiscountPercent);
  const effectiveLoadRate = effectiveLoadPercent / 100;

  n.insuranceNetPremium = n.amount / (1 + n.insuranceTaxRate);
  const initialInsuranceTax = n.amount - n.insuranceNetPremium;
  const totalEntryCost = n.insuranceNetPremium * n.insuranceEntryCostRate;
  const entryCostPerYear = totalEntryCost / n.insuranceEntryCostYears;

  const directInitialInvestment = n.amount / (1 + effectiveLoadRate);
  const issueLoadCost = n.amount - directInitialInvestment;

  let insuranceBalance = n.insuranceNetPremium;
  let directBalance = directInitialInvestment;
  let directTaxBasis = directInitialInvestment;

  let insuranceFundCosts = 0;
  let insuranceAdminCosts = 0;
  let insuranceRiskCosts = 0;
  let insuranceEntryCostsCharged = 0;
  let directFundCosts = 0;
  let directDepotCosts = 0;
  let directAnnualTaxes = 0;
  let cumulativeTaxedIncome = 0;

  const history = [];

  for (let year = 1; year <= n.years; year += 1) {
    const entryCost = year <= n.insuranceEntryCostYears
      ? Math.min(entryCostPerYear, insuranceBalance)
      : 0;
    insuranceBalance -= entryCost;
    insuranceEntryCostsCharged += entryCost;

    const riskCost = Math.min(n.insuranceRiskAnnual, insuranceBalance);
    insuranceBalance -= riskCost;
    insuranceRiskCosts += riskCost;

    const insuranceFund = applyFundYear(insuranceBalance, n.grossReturnRate, n.fundCostRate);
    insuranceBalance = insuranceFund.closing;
    insuranceFundCosts += insuranceFund.fundCost;

    const adminCost = Math.min(insuranceBalance * n.insuranceAdminRate, insuranceBalance);
    insuranceBalance -= adminCost;
    insuranceAdminCosts += adminCost;

    const directOpening = directBalance;
    const directFund = applyFundYear(directBalance, n.grossReturnRate, n.fundCostRate);
    directBalance = directFund.closing;
    directFundCosts += directFund.fundCost;

    const depotPercentCost = Math.min(directBalance * n.depotFeeRate, directBalance);
    directBalance -= depotPercentCost;
    const depotFixedCost = Math.min(n.depotFeeAnnual, directBalance);
    directBalance -= depotFixedCost;
    directDepotCosts += depotPercentCost + depotFixedCost;

    if (n.directTaxMode === "annual_proxy") {
      const taxableIncome = Math.max(0, directOpening * n.annualTaxableYieldRate);
      const tax = Math.min(taxableIncome * n.capitalGainsTaxRate, directBalance);
      directBalance -= tax;
      directAnnualTaxes += tax;
      cumulativeTaxedIncome += taxableIncome;
      directTaxBasis = directInitialInvestment + cumulativeTaxedIncome;
    }

    const insuranceTaxes = insuranceExitTaxes(insuranceBalance, year, n);
    const insuranceNet = Math.max(0, insuranceBalance - insuranceTaxes.additionalInsuranceTax - insuranceTaxes.incomeTax);
    const directExit = directLiquidation(directBalance, directTaxBasis, directAnnualTaxes, n);

    history.push({
      year,
      insuranceGrossValue: insuranceBalance,
      insuranceNetValue: insuranceNet,
      directGrossValue: directBalance,
      directNetValue: directExit.netValue,
      insuranceExitTaxes: insuranceTaxes.additionalInsuranceTax + insuranceTaxes.incomeTax,
      directTax: directExit.totalTax
    });
  }

  const finalInsuranceExit = insuranceExitTaxes(insuranceBalance, n.years, n);
  const insuranceEndValue = Math.max(0, insuranceBalance - finalInsuranceExit.additionalInsuranceTax - finalInsuranceExit.incomeTax);
  const finalDirect = directLiquidation(directBalance, directTaxBasis, directAnnualTaxes, n);
  const directEndValue = finalDirect.netValue;

  const breakEven = history.find((point) => point.insuranceNetValue > point.directNetValue + 0.005)?.year ?? null;

  return {
    inputs: {
      amount: n.amount,
      years: n.years,
      minimumTaxYears: qualifyingMinimumYears(n.age50Plus),
      effectiveIssueLoadPercent: effectiveLoadPercent
    },
    insurance: {
      initialNetPremium: n.insuranceNetPremium,
      initialInsuranceTax,
      totalEntryCost,
      entryCostCharged: insuranceEntryCostsCharged,
      entryCostPerYear,
      fundCosts: insuranceFundCosts,
      adminCosts: insuranceAdminCosts,
      riskCosts: insuranceRiskCosts,
      grossValue: insuranceBalance,
      additionalInsuranceTax: finalInsuranceExit.additionalInsuranceTax,
      incomeTax: finalInsuranceExit.incomeTax,
      totalTaxes: initialInsuranceTax + finalInsuranceExit.additionalInsuranceTax + finalInsuranceExit.incomeTax,
      endValue: insuranceEndValue,
      effectiveReturn: annualEffectiveReturn(n.amount, insuranceEndValue, n.years),
      earlyExit: finalInsuranceExit.earlyExit
    },
    direct: {
      initialInvestment: directInitialInvestment,
      issueLoadCost,
      fundCosts: directFundCosts,
      depotCosts: directDepotCosts,
      annualTaxes: directAnnualTaxes,
      saleTax: finalDirect.saleTax,
      totalTaxes: finalDirect.totalTax,
      taxableGainAtExit: finalDirect.taxableGain,
      taxBasisAtExit: directTaxBasis,
      grossValue: directBalance,
      endValue: directEndValue,
      effectiveReturn: annualEffectiveReturn(n.amount, directEndValue, n.years)
    },
    comparison: {
      difference: insuranceEndValue - directEndValue,
      differencePercentOfInvestment: ((insuranceEndValue - directEndValue) / n.amount) * 100,
      winner: Math.abs(insuranceEndValue - directEndValue) < 0.005 ? "equal" : (insuranceEndValue > directEndValue ? "insurance" : "direct"),
      breakEvenYear: breakEven
    },
    history
  };
}

export function createInsuranceFundCompareData({ inputs, toolboxVersion = "", exportedAt = "" }) {
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) throw new Error("Eingabedaten fehlen.");
  // Validieren, ohne das Rechenergebnis mitzuspeichern.
  simulateInsuranceFundComparison(inputs);
  return {
    format: INSURANCE_FUND_COMPARE_FORMAT,
    schema_version: INSURANCE_FUND_COMPARE_SCHEMA_VERSION,
    toolbox_version: String(toolboxVersion || ""),
    exported_at: String(exportedAt || ""),
    inputs: { ...inputs }
  };
}

export function normalizeInsuranceFundCompareData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Die Datei enthält keine gültigen Vergleichsdaten.");
  if (payload.format !== INSURANCE_FUND_COMPARE_FORMAT || Number(payload.schema_version) !== INSURANCE_FUND_COMPARE_SCHEMA_VERSION) {
    throw new Error("Die Datei ist keine unterstützte Versicherungs-/Fondsvergleich-Datei.");
  }
  if (!payload.inputs || typeof payload.inputs !== "object" || Array.isArray(payload.inputs)) throw new Error("Die Importdatei enthält keine Eingabedaten.");
  simulateInsuranceFundComparison(payload.inputs);
  return { inputs: { ...payload.inputs } };
}
