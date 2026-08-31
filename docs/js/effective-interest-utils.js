import {
  actualDays,
  maturityDate,
  solveBankRate
} from "./bundesschatz-utils.js";

const ALLOWED_KEST_RATES = [0, 0.25, 0.275];
const ALLOWED_INSURANCE_TAX_RATES = [0, 0.04, 0.11];
const ALLOWED_PAYOUT_MODES = ["net", "gross"];

export function commercialRoundPercent(rateDecimal) {
  const percent = Number(rateDecimal) * 100;
  if (!Number.isFinite(percent)) throw new Error("Ungültiger Zinssatz.");
  const sign = percent < 0 ? -1 : 1;
  return sign * (Math.floor(Math.abs(percent) * 100 + 0.5 + 1e-10) / 100);
}

export function calculateEffectiveInterest({
  depositAmount,
  payoutAmount,
  payoutMode = "net",
  termValue,
  termUnit,
  kestPercent = 0,
  insuranceTaxPercent = 0,
  startDate
}) {
  const deposit = Number(depositAmount);
  const payout = Number(payoutAmount);
  const term = Number(termValue);
  const mode = String(payoutMode);

  if (!Number.isFinite(deposit) || deposit <= 0) throw new Error("Der Einzahlungsbetrag muss größer als 0 sein.");
  if (!Number.isFinite(payout) || payout <= 0) throw new Error("Der Auszahlungsbetrag muss größer als 0 sein.");
  if (!Number.isInteger(term) || term <= 0) throw new Error("Die Laufzeit muss eine positive ganze Zahl sein.");
  if (!["D", "M", "Y"].includes(termUnit)) throw new Error("Ungültige Laufzeiteinheit.");
  if (!ALLOWED_PAYOUT_MODES.includes(mode)) throw new Error("Ungültiger Auszahlungsmodus.");

  const rawKestRate = Number(kestPercent) / 100;
  const rawInsuranceTaxRate = Number(insuranceTaxPercent) / 100;
  if (!ALLOWED_KEST_RATES.includes(rawKestRate)) throw new Error("Ungültiger KESt-Satz.");
  if (!ALLOWED_INSURANCE_TAX_RATES.includes(rawInsuranceTaxRate)) throw new Error("Ungültiger Versicherungssteuersatz.");

  // Bei einer bereits netto vorliegenden Auszahlung sind Steuerparameter für den
  // Cashflow-Vergleich nicht erforderlich und werden vollständig ignoriert.
  const kestRate = mode === "gross" ? rawKestRate : 0;
  const insuranceTaxRate = mode === "gross" ? rawInsuranceTaxRate : 0;

  const endDate = maturityDate(startDate, term, termUnit);
  const days = actualDays(startDate, endDate);
  if (days <= 0) throw new Error("Die Laufzeit muss größer als 0 sein.");

  let netInvestment = deposit;
  let insuranceTaxAmount = 0;
  let grossPayout = payout;
  let grossGainBeforeKest = Math.max(payout - deposit, 0);
  let kestAmount = 0;
  let netPayout = payout;

  if (mode === "gross") {
    // Der Einzahlungsbetrag ist der tatsächlich bezahlte Gesamtbetrag.
    // Eine Versicherungssteuer ist darin enthalten und wird herausgerechnet.
    netInvestment = deposit / (1 + insuranceTaxRate);
    insuranceTaxAmount = deposit - netInvestment;

    // Bei Brutto-Auszahlung wird KESt nur auf einen positiven Ertrag gegenüber
    // dem netto veranlagten Betrag gerechnet.
    grossGainBeforeKest = Math.max(grossPayout - netInvestment, 0);
    kestAmount = grossGainBeforeKest * kestRate;
    netPayout = grossPayout - kestAmount;
  }

  // Kundensicht: tatsächliche Einzahlung versus tatsächliche Netto-Auszahlung.
  const targetFactor = netPayout / deposit;
  const totalNetReturn = targetFactor - 1;
  const yearFraction = termUnit === "Y"
    ? term
    : termUnit === "M"
      ? term / 12
      : days / 365;
  const annualizedNetReturn = Math.pow(targetFactor, 1 / yearFraction) - 1;

  let bankRate = 0;
  let bankRateNotRequired = targetFactor <= 1;
  if (!bankRateNotRequired) {
    bankRate = solveBankRate(targetFactor, startDate, endDate);
    if (bankRate === null) {
      bankRateNotRequired = true;
      bankRate = 0;
    }
  }

  return {
    startDate,
    endDate,
    days,
    yearFraction,
    deposit,
    payout,
    payoutMode: mode,
    kestRate,
    insuranceTaxRate,
    insuranceTaxAmount,
    netInvestment,
    grossPayout,
    grossGainBeforeKest,
    kestAmount,
    netPayout,
    targetFactor,
    totalNetReturn,
    annualizedNetReturn,
    bankRate,
    bankRateNotRequired,
    taxCombinationWarning: mode === "gross" && insuranceTaxRate > 0 && kestRate > 0
  };
}
