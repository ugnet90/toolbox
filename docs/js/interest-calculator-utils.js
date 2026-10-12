const ALLOWED_METHODS = new Set(["ACT_360", "ACT_365", "30_360"]);

function parseIsoDate(value, fieldName) {
  const raw = String(value ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) throw new Error(`${fieldName} ist ungültig.`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} ist ungültig.`);
  }
  return { raw, year, month, day, time: date.getTime() };
}

function actualDaysBetween(start, end) {
  return Math.round((end.time - start.time) / 86400000);
}

function days30E360(start, end) {
  const d1 = Math.min(start.day, 30);
  const d2 = Math.min(end.day, 30);
  return 360 * (end.year - start.year) + 30 * (end.month - start.month) + (d2 - d1);
}

function periodFromDays(dayCount, calculationMethod) {
  const method = String(calculationMethod || "");
  if (!ALLOWED_METHODS.has(method)) throw new Error("Ungültige Berechnungsart.");
  const days = Number(dayCount);
  if (!Number.isInteger(days) || days < 0) throw new Error("Anzahl Tage muss eine ganze Zahl ab 0 sein.");
  const denominator = method === "ACT_365" ? 365 : 360;
  return { days, denominator, yearFraction: days / denominator, method, periodSource: "days" };
}

export function interestPeriod(startDate, endDate, calculationMethod = "ACT_360") {
  const method = String(calculationMethod || "");
  if (!ALLOWED_METHODS.has(method)) throw new Error("Ungültige Berechnungsart.");

  const start = parseIsoDate(startDate, "Datum von");
  const end = parseIsoDate(endDate, "Datum bis");
  if (end.time < start.time) throw new Error("Datum bis darf nicht vor Datum von liegen.");

  if (method === "30_360") {
    const days = days30E360(start, end);
    return { days, denominator: 360, yearFraction: days / 360, method, periodSource: "dates" };
  }

  const days = actualDaysBetween(start, end);
  const denominator = method === "ACT_365" ? 365 : 360;
  return { days, denominator, yearFraction: days / denominator, method, periodSource: "dates" };
}

export function interestPeriodFromDays(dayCount, calculationMethod = "ACT_360") {
  return periodFromDays(dayCount, calculationMethod);
}

export function calculateInterest({
  debitRatePercent,
  overdraftRatePercent = 0,
  limitAmount = 0,
  amount,
  startDate = "",
  endDate = "",
  dayCount = null,
  calculationMethod = "ACT_360"
}) {
  const debitRate = Number(debitRatePercent);
  const overdraftRate = overdraftRatePercent === "" || overdraftRatePercent === null || overdraftRatePercent === undefined
    ? 0
    : Number(overdraftRatePercent);
  const limit = limitAmount === "" || limitAmount === null || limitAmount === undefined
    ? 0
    : Number(limitAmount);
  const principal = Number(amount);

  if (!Number.isFinite(debitRate) || debitRate < 0) throw new Error("Sollzinssatz muss mindestens 0 % sein.");
  if (!Number.isFinite(overdraftRate) || overdraftRate < 0) throw new Error("Überziehungszinssatz muss mindestens 0 % sein.");
  if (!Number.isFinite(limit) || limit < 0) throw new Error("Rahmen muss mindestens 0 € sein.");
  if (!Number.isFinite(principal) || principal < 0) throw new Error("Betrag muss mindestens 0 € sein.");

  const useDirectDays = dayCount !== null && dayCount !== undefined && String(dayCount).trim() !== "";
  const period = useDirectDays
    ? periodFromDays(dayCount, calculationMethod)
    : interestPeriod(startDate, endDate, calculationMethod);

  const overdraftAmount = Math.max(principal - limit, 0);
  const debitInterest = principal * (debitRate / 100) * period.yearFraction;
  const overdraftInterest = overdraftAmount * (overdraftRate / 100) * period.yearFraction;
  const totalInterest = debitInterest + overdraftInterest;

  return {
    ...period,
    debitRatePercent: debitRate,
    overdraftRatePercent: overdraftRate,
    limitAmount: limit,
    amount: principal,
    overdraftAmount,
    debitInterest,
    overdraftInterest,
    totalInterest
  };
}
