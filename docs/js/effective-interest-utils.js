import {
  actualDays,
  maturityDate,
  solveBankRate
} from "./bundesschatz-utils.js";

const ALLOWED_KEST_RATES = [0, 0.25, 0.275];
const ALLOWED_INSURANCE_TAX_RATES = [0, 0.04, 0.11];

export function calculateEffectiveInterest({
  depositAmount,
  payoutAmount,
  termValue,
  termUnit,
  kestPercent,
  insuranceTaxPercent,
  startDate
}) {
  const deposit = Number(depositAmount);
  const payout = Number(payoutAmount);
  const term = Number(termValue);
  const kestRate = Number(kestPercent) / 100;
  const insuranceTaxRate = Number(insuranceTaxPercent) / 100;

  if (!Number.isFinite(deposit) || deposit <= 0) throw new Error("Der Einzahlungsbetrag muss größer als 0 sein.");
  if (!Number.isFinite(payout) || payout <= 0) throw new Error("Der Auszahlungsbetrag muss größer als 0 sein.");
  if (!Number.isInteger(term) || term <= 0) throw new Error("Die Laufzeit muss eine positive ganze Zahl sein.");
  if (!["D", "M", "Y"].includes(termUnit)) throw new Error("Ungültige Laufzeiteinheit.");
  if (!ALLOWED_KEST_RATES.includes(kestRate)) throw new Error("Ungültiger KESt-Satz.");
  if (!ALLOWED_INSURANCE_TAX_RATES.includes(insuranceTaxRate)) throw new Error("Ungültiger Versicherungssteuersatz.");

  const endDate = maturityDate(startDate, term, termUnit);
  const days = actualDays(startDate, endDate);
  if (days <= 0) throw new Error("Die Laufzeit muss größer als 0 sein.");

  // Der Einzahlungsbetrag ist der tatsächlich vom Kunden bezahlte Gesamtbetrag.
  // Eine allfällige Versicherungssteuer ist darin enthalten und wird herausgerechnet.
  const netInvestment = deposit / (1 + insuranceTaxRate);
  const insuranceTaxAmount = deposit - netInvestment;

  // Der eingegebene Auszahlungsbetrag ist bereits netto nach einer allfälligen KESt.
  // Der KESt-Satz dient daher nur zur rechnerischen Rückrechnung der enthaltenen Steuer.
  const netGainAfterKest = Math.max(payout - netInvestment, 0);
  const grossGainBeforeKest = kestRate > 0
    ? netGainAfterKest / (1 - kestRate)
    : netGainAfterKest;
  const kestAmount = grossGainBeforeKest - netGainAfterKest;

  // Kundensicht: gleicher tatsächlich bezahlter Kapitaleinsatz und gleiche Netto-Auszahlung.
  const netPayout = payout;
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
    kestRate,
    insuranceTaxRate,
    insuranceTaxAmount,
    netInvestment,
    netGainAfterKest,
    grossGainBeforeKest,
    kestAmount,
    netPayout,
    targetFactor,
    totalNetReturn,
    annualizedNetReturn,
    bankRate,
    bankRateNotRequired,
    taxCombinationWarning: insuranceTaxRate > 0 && kestRate > 0
  };
}
