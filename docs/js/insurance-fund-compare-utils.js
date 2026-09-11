export const INSURANCE_FUND_COMPARE_FORMAT = "toolbox-insurance-fund-compare";
export const INSURANCE_FUND_COMPARE_SCHEMA_VERSION = 3;

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

export function suggestReturnScenarios(historicalPercent) {
  const historical = finite(historicalPercent, "Historische Rendite", { min: -100, max: 100 });
  const integer = Number.isInteger(historical);
  const lowerTop = integer ? historical - 1 : Math.floor(historical);
  const upperBottom = integer ? historical + 1 : Math.ceil(historical);
  return [lowerTop - 1, lowerTop, historical, upperBottom, upperBottom + 1];
}

function applyFundYear(balance, fundReturnRate) {
  return Math.max(0, balance * (1 + fundReturnRate));
}

function qualifyingMinimumYears(age50Plus) {
  return age50Plus ? 10 : 15;
}

export function insuranceTaxPercentForTerm(years, age50Plus) {
  const term = finite(years, "Laufzeit", { min: 1, max: 60, integer: true });
  return term < qualifyingMinimumYears(Boolean(age50Plus)) ? 11 : 4;
}

function normalizeInputs(raw = {}) {
  const amount = finite(raw.amount, "Anlagebetrag", { min: 0.01 });
  const years = finite(raw.years, "Laufzeit", { min: 1, max: 60, integer: true });
  // Die eingegebene Fondsrendite ist bereits NACH den auf Fondsebene anfallenden Kosten.
  const fundReturnPercent = finite(raw.grossReturnPercent, "Fondsrendite", { min: -100, max: 100 });

  const insuranceTaxPercent = finite(raw.insuranceTaxPercent, "Versicherungssteuer", { min: 0, max: 30 });
  const insuranceEntryCostPercent = finite(raw.insuranceEntryCostPercent, "Abschlusskosten", { min: 0, max: 50 });
  const insuranceEntryCostYears = finite(raw.insuranceEntryCostYears, "Verteilung der Abschlusskosten", { min: 1, max: 20, integer: true });
  // v1/v2 verwendeten nur insuranceAdminPercent. Dieser Wert wird bei alten Daten
  // als vermögensabhängige Verwaltungskomponente übernommen.
  const legacyAdminPercent = raw.insuranceAdminPercent;
  const insuranceAdminPremiumPercent = finite(raw.insuranceAdminPremiumPercent ?? 0, "Verwaltungskosten auf Netto-Einmalprämie", { min: 0, max: 20 });
  const insuranceAdminAssetPercent = finite(raw.insuranceAdminAssetPercent ?? legacyAdminPercent ?? 0, "Verwaltungskosten auf Vermögen", { min: 0, max: 20 });
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
    throw new Error(`Für das gewählte Versicherungsprodukt beträgt die Mindest-Einmalprämie ${insuranceMinimumAmount.toLocaleString("de-AT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €.`);
  }

  return {
    amount,
    years,
    fundReturnRate: fundReturnPercent / 100,
    insuranceTaxRate: insuranceTaxPercent / 100,
    insuranceEntryCostRate: insuranceEntryCostPercent / 100,
    insuranceEntryCostYears,
    insuranceAdminPremiumRate: insuranceAdminPremiumPercent / 100,
    insuranceAdminAssetRate: insuranceAdminAssetPercent / 100,
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
  const additionalInsuranceTax = n.insuranceTaxRate > EPS ? n.insuranceNetPremium * 0.07 : 0;
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

function calculateBreakEven(history) {
  for (let index = 0; index < history.length; index += 1) {
    const current = history[index];
    const currentDiff = current.insuranceNetValue - current.directNetValue;
    if (currentDiff <= 0.005) continue;
    if (index === 0) return { firstYear: current.year, approxYear: current.year };
    const previous = history[index - 1];
    const previousDiff = previous.insuranceNetValue - previous.directNetValue;
    if (previousDiff >= -0.005) return { firstYear: current.year, approxYear: current.year };
    const span = currentDiff - previousDiff;
    const fraction = span > EPS ? (-previousDiff / span) : 1;
    return {
      firstYear: current.year,
      approxYear: previous.year + Math.min(1, Math.max(0, fraction))
    };
  }
  return { firstYear: null, approxYear: null };
}

export function simulateInsuranceFundComparison(rawInputs) {
  const n = normalizeInputs(rawInputs);
  const effectiveLoadPercent = effectiveIssueLoadPercent(n.issueLoadPercent, n.issueLoadDiscountPercent);
  const effectiveLoadRate = effectiveLoadPercent / 100;

  n.insuranceNetPremium = n.amount / (1 + n.insuranceTaxRate);
  const initialInsuranceTax = n.amount - n.insuranceNetPremium;
  const totalEntryCost = n.insuranceNetPremium * n.insuranceEntryCostRate;
  const entryCostPerYear = totalEntryCost / n.insuranceEntryCostYears;
  const adminPremiumCostPerYear = n.insuranceNetPremium * n.insuranceAdminPremiumRate;

  const directInitialInvestment = n.amount / (1 + effectiveLoadRate);
  const issueLoadCost = n.amount - directInitialInvestment;

  let insuranceBalance = n.insuranceNetPremium;
  let directBalance = directInitialInvestment;
  let directTaxBasis = directInitialInvestment;

  let insuranceAdminPremiumCosts = 0;
  let insuranceAdminAssetCosts = 0;
  let insuranceRiskCosts = 0;
  let insuranceEntryCostsCharged = 0;
  let directDepotCosts = 0;
  let directAnnualTaxes = 0;
  let cumulativeTaxedIncome = 0;

  const history = [];

  for (let year = 1; year <= n.years; year += 1) {
    const entryCost = year <= n.insuranceEntryCostYears ? Math.min(entryCostPerYear, insuranceBalance) : 0;
    insuranceBalance -= entryCost;
    insuranceEntryCostsCharged += entryCost;

    const riskCost = Math.min(n.insuranceRiskAnnual, insuranceBalance);
    insuranceBalance -= riskCost;
    insuranceRiskCosts += riskCost;

    insuranceBalance = applyFundYear(insuranceBalance, n.fundReturnRate);

    const adminPremiumCost = Math.min(adminPremiumCostPerYear, insuranceBalance);
    insuranceBalance -= adminPremiumCost;
    insuranceAdminPremiumCosts += adminPremiumCost;

    const adminAssetCost = Math.min(insuranceBalance * n.insuranceAdminAssetRate, insuranceBalance);
    insuranceBalance -= adminAssetCost;
    insuranceAdminAssetCosts += adminAssetCost;

    const directOpening = directBalance;
    directBalance = applyFundYear(directBalance, n.fundReturnRate);

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
  const breakEven = calculateBreakEven(history);
  const insuranceAdminCosts = insuranceAdminPremiumCosts + insuranceAdminAssetCosts;
  const insuranceTotalCosts = insuranceEntryCostsCharged + insuranceAdminCosts + insuranceRiskCosts;
  const directTotalCosts = issueLoadCost + directDepotCosts;

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
      adminPremiumCostPerYear,
      adminPremiumCosts: insuranceAdminPremiumCosts,
      adminAssetCosts: insuranceAdminAssetCosts,
      adminCosts: insuranceAdminCosts,
      riskCosts: insuranceRiskCosts,
      totalCosts: insuranceTotalCosts,
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
      depotCosts: directDepotCosts,
      totalCosts: directTotalCosts,
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
      breakEvenYear: breakEven.firstYear,
      breakEvenYearApprox: breakEven.approxYear
    },
    history
  };
}

export function createInsuranceFundCompareData({ inputs, toolboxVersion = "", exportedAt = "" }) {
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) throw new Error("Eingabedaten fehlen.");
  simulateInsuranceFundComparison(inputs);
  const cleanedInputs = { ...inputs };
  delete cleanedInputs.fundCostPercent;
  delete cleanedInputs.insuranceAdminPercent;
  return {
    format: INSURANCE_FUND_COMPARE_FORMAT,
    schema_version: INSURANCE_FUND_COMPARE_SCHEMA_VERSION,
    toolbox_version: String(toolboxVersion || ""),
    exported_at: String(exportedAt || ""),
    inputs: cleanedInputs
  };
}

export function normalizeInsuranceFundCompareData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Die Datei enthält keine gültigen Vergleichsdaten.");
  const schema = Number(payload.schema_version);
  if (payload.format !== INSURANCE_FUND_COMPARE_FORMAT || ![1, 2, INSURANCE_FUND_COMPARE_SCHEMA_VERSION].includes(schema)) {
    throw new Error("Die Datei ist keine unterstützte Versicherungs-/Fondsvergleich-Datei.");
  }
  if (!payload.inputs || typeof payload.inputs !== "object" || Array.isArray(payload.inputs)) throw new Error("Die Importdatei enthält keine Eingabedaten.");
  const inputs = { ...payload.inputs };
  delete inputs.fundCostPercent;
  if (inputs.insuranceAdminAssetPercent === undefined && inputs.insuranceAdminPercent !== undefined) {
    inputs.insuranceAdminAssetPercent = inputs.insuranceAdminPercent;
  }
  if (inputs.insuranceAdminPremiumPercent === undefined) inputs.insuranceAdminPremiumPercent = 0;
  delete inputs.insuranceAdminPercent;
  simulateInsuranceFundComparison(inputs);
  return { inputs };
}
