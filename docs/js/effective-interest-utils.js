import {
  actualDays,
  maturityDate,
  solveBankRate
} from "./bundesschatz-utils.js";

export const GENERIC_KEST = 0.275;

export function calculateEffectiveInterest({
  depositAmount,
  payoutAmount,
  termValue,
  termUnit,
  kestFree,
  insuranceTaxPercent,
  startDate
}) {
  const deposit = Number(depositAmount);
  const payout = Number(payoutAmount);
  const term = Number(termValue);
  const insuranceTaxRate = Number(insuranceTaxPercent) / 100;

  if (!Number.isFinite(deposit) || deposit <= 0) throw new Error("Der Einzahlungsbetrag muss größer als 0 sein.");
  if (!Number.isFinite(payout) || payout <= 0) throw new Error("Der Auszahlungsbetrag muss größer als 0 sein.");
  if (!Number.isInteger(term) || term <= 0) throw new Error("Die Laufzeit muss eine positive ganze Zahl sein.");
  if (!["D", "M", "Y"].includes(termUnit)) throw new Error("Ungültige Laufzeiteinheit.");
  if (![0, 0.04, 0.11].includes(insuranceTaxRate)) throw new Error("Ungültiger Versicherungssteuersatz.");

  const endDate = maturityDate(startDate, term, termUnit);
  const days = actualDays(startDate, endDate);
  if (days <= 0) throw new Error("Die Laufzeit muss größer als 0 sein.");

  const insuranceTaxAmount = deposit * insuranceTaxRate;
  const totalOutlay = deposit + insuranceTaxAmount;
  const taxableGain = Math.max(payout - deposit, 0);
  const kestAmount = kestFree ? 0 : taxableGain * GENERIC_KEST;
  const netPayout = payout - kestAmount;
  const targetFactor = netPayout / totalOutlay;
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
    insuranceTaxRate,
    insuranceTaxAmount,
    totalOutlay,
    taxableGain,
    kestAmount,
    netPayout,
    targetFactor,
    totalNetReturn,
    annualizedNetReturn,
    bankRate,
    bankRateNotRequired
  };
}
