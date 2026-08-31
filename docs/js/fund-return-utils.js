const MS_PER_DAY = 86_400_000;

export function parseGermanNumber(value) {
  let normalized = String(value ?? "").trim().replace(/[\s']/g, "");
  if (!normalized) return NaN;

  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");

  if (comma >= 0 && dot >= 0) {
    if (comma > dot) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (comma >= 0) {
    normalized = normalized.replace(",", ".");
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }

  return Number(normalized);
}

export function formatGermanNumber(value, decimals = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";

  const sign = number < 0 ? "-" : "";
  const [integerPart, fractionPart] = Math.abs(number).toFixed(decimals).split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decimals > 0 ? `${sign}${grouped},${fractionPart}` : `${sign}${grouped}`;
}

export function parseIsoDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!match) throw new Error("Ungültiges Datum.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Ungültiges Datum.");
  }
  return date;
}

export function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function daysBetween(startIso, endIso) {
  return Math.round((parseIsoDate(endIso) - parseIsoDate(startIso)) / MS_PER_DAY);
}

function daysInMonthUtc(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function addMonthsAnchored(firstIso, monthsToAdd) {
  const first = parseIsoDate(firstIso);
  const anchorDay = first.getUTCDate();
  const totalMonth = first.getUTCFullYear() * 12 + first.getUTCMonth() + Number(monthsToAdd);
  const year = Math.floor(totalMonth / 12);
  const monthIndex = totalMonth - year * 12;
  const day = Math.min(anchorDay, daysInMonthUtc(year, monthIndex));
  return toIsoDate(new Date(Date.UTC(year, monthIndex, day)));
}

export function generateRecurringDates({ firstDate, lastDate, intervalMonths }) {
  parseIsoDate(firstDate);
  parseIsoDate(lastDate);
  const interval = Number(intervalMonths);
  if (!Number.isInteger(interval) || interval <= 0) {
    throw new Error("Ungültiges Zahlungsintervall.");
  }
  if (firstDate > lastDate) {
    throw new Error("Die letzte Zahlung darf nicht vor der ersten Zahlung liegen.");
  }

  const dates = [];
  for (let i = 0; i < 1200; i += 1) {
    const date = addMonthsAnchored(firstDate, i * interval);
    if (date > lastDate) break;
    dates.push(date);
  }
  if (!dates.length) throw new Error("Es konnten keine Zahlungstermine erzeugt werden.");
  if (dates.length >= 1200) throw new Error("Zu viele Zahlungstermine.");
  return dates;
}

export function initialInvestment({ amount, amountMode = "gross", purchaseFeePercent = 0 }) {
  const inputAmount = Number(amount);
  const feeRate = Number(purchaseFeePercent) / 100;
  if (!Number.isFinite(inputAmount) || inputAmount <= 0) {
    throw new Error("Der Startbetrag muss größer als 0 sein.");
  }
  if (!Number.isFinite(feeRate) || feeRate < 0 || feeRate > 1) {
    throw new Error("Ungültige Kaufspesen.");
  }
  if (!["gross", "net"].includes(amountMode)) {
    throw new Error("Ungültiger Modus für den Startbetrag.");
  }

  let customerOutflow;
  let netInvested;
  let feeAmount;

  if (amountMode === "gross") {
    customerOutflow = inputAmount;
    netInvested = inputAmount / (1 + feeRate);
    feeAmount = customerOutflow - netInvested;
  } else {
    netInvested = inputAmount;
    customerOutflow = inputAmount * (1 + feeRate);
    feeAmount = customerOutflow - netInvested;
  }

  return { customerOutflow, netInvested, feeAmount, feeRate };
}

function normalizeCashflows(cashflows) {
  if (!Array.isArray(cashflows) || cashflows.length < 2) {
    throw new Error("Für die Renditeberechnung werden mindestens zwei Zahlungsströme benötigt.");
  }

  const normalized = cashflows.map((item) => {
    const amount = Number(item.amount);
    if (!Number.isFinite(amount)) throw new Error("Ein Zahlungsstrom enthält einen ungültigen Betrag.");
    parseIsoDate(item.date);
    return { ...item, amount, date: String(item.date) };
  }).sort((a, b) => a.date.localeCompare(b.date));

  if (!normalized.some((item) => item.amount < 0) || !normalized.some((item) => item.amount > 0)) {
    throw new Error("Für XIRR werden mindestens ein negativer und ein positiver Zahlungsstrom benötigt.");
  }

  return normalized;
}

function npvForLogRate(cashflows, baseDate, y) {
  return cashflows.reduce((sum, item) => {
    const years = daysBetween(baseDate, item.date) / 365;
    return sum + item.amount * Math.exp(-y * years);
  }, 0);
}

function bisectRoot(cashflows, baseDate, lowY, highY) {
  let low = lowY;
  let high = highY;
  let fLow = npvForLogRate(cashflows, baseDate, low);
  let fHigh = npvForLogRate(cashflows, baseDate, high);

  for (let i = 0; i < 120; i += 1) {
    const mid = (low + high) / 2;
    const fMid = npvForLogRate(cashflows, baseDate, mid);
    if (Math.abs(fMid) < 1e-9) return mid;
    if (Math.sign(fMid) === Math.sign(fLow)) {
      low = mid;
      fLow = fMid;
    } else {
      high = mid;
      fHigh = fMid;
    }
    if (Math.abs(high - low) < 1e-12 || Math.abs(fHigh - fLow) < 1e-12) break;
  }
  return (low + high) / 2;
}

export function calculateXirr(cashflows) {
  const normalized = normalizeCashflows(cashflows);
  const baseDate = normalized[0].date;
  const roots = [];
  const minY = -11.5;
  const maxY = 11.5;
  const steps = 920;

  let previousY = minY;
  let previousF = npvForLogRate(normalized, baseDate, previousY);

  for (let i = 1; i <= steps; i += 1) {
    const currentY = minY + ((maxY - minY) * i) / steps;
    const currentF = npvForLogRate(normalized, baseDate, currentY);

    if (Math.abs(previousF) < 1e-7) roots.push(previousY);
    if (Number.isFinite(previousF) && Number.isFinite(currentF) && Math.sign(previousF) !== Math.sign(currentF)) {
      roots.push(bisectRoot(normalized, baseDate, previousY, currentY));
    }

    previousY = currentY;
    previousF = currentF;
  }

  const rates = roots
    .map((y) => Math.expm1(y))
    .filter((rate) => Number.isFinite(rate) && rate > -1)
    .sort((a, b) => Math.abs(a) - Math.abs(b));

  const deduped = [];
  for (const rate of rates) {
    if (!deduped.some((existing) => Math.abs(existing - rate) < 1e-7)) deduped.push(rate);
  }

  if (!deduped.length) {
    throw new Error("Für diese Zahlungsströme konnte kein eindeutiger Effektivzinssatz ermittelt werden.");
  }

  return {
    rate: deduped[0],
    rootCount: deduped.length,
    roots: deduped
  };
}

export function monthKey(isoDate) {
  parseIsoDate(isoDate);
  return isoDate.slice(0, 7);
}

function nextMonthBoundary(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function nextYearBoundary(date) {
  return new Date(Date.UTC(date.getUTCFullYear() + 1, 0, 1));
}

function rateMapFromObservations(observations) {
  const map = new Map();
  for (const obs of observations ?? []) {
    const period = String(obs.period ?? "");
    const rate = Number(obs.rate);
    if (/^\d{4}-\d{2}$/.test(period) && Number.isFinite(rate)) map.set(period, rate);
  }
  return map;
}

export function simulateHistoricalRateBenchmark({
  cashflows,
  endDate,
  observations,
  taxPercent = 0,
  seriesLabel = "historische Zinsdaten"
}) {
  const flows = (cashflows ?? []).map((item) => ({
    ...item,
    amount: Number(item.amount),
    date: String(item.date)
  })).sort((a, b) => a.date.localeCompare(b.date));

  if (!flows.length) throw new Error("Keine Zahlungsströme für den historischen Vergleich vorhanden.");
  parseIsoDate(endDate);
  const taxRate = Number(taxPercent) / 100;
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate >= 1) throw new Error("Ungültiger KESt-Satz für den Vergleich.");

  const rates = rateMapFromObservations(observations);
  const ratePeriods = [...rates.keys()].sort();
  if (!ratePeriods.length) throw new Error(`Keine ${seriesLabel} verfügbar.`);

  const firstOfficialPeriod = ratePeriods[0];
  const lastOfficialPeriod = ratePeriods[ratePeriods.length - 1];
  const lastOfficialRate = rates.get(lastOfficialPeriod);
  const startDate = flows[0].date;
  const requiredStartPeriod = monthKey(startDate);
  const requiredEndPeriod = monthKey(endDate);
  if (startDate > endDate) throw new Error("Das Vergleichsende liegt vor dem ersten Zahlungsstrom.");
  if (firstOfficialPeriod > requiredStartPeriod) {
    throw new Error(`ECB-Daten beginnen erst mit ${firstOfficialPeriod}; benötigt wird ${requiredStartPeriod}.`);
  }

  let cursor = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  let balance = 0;
  let accruedGrossInterest = 0;
  let totalGrossInterest = 0;
  let totalTax = 0;
  let carriedForward = false;
  let carriedForwardFrom = null;
  let carriedForwardThrough = null;

  function creditInterest() {
    if (Math.abs(accruedGrossInterest) < 1e-12) return;
    const taxableInterest = Math.max(accruedGrossInterest, 0);
    const tax = taxableInterest * taxRate;
    balance += accruedGrossInterest - tax;
    totalGrossInterest += accruedGrossInterest;
    totalTax += tax;
    accruedGrossInterest = 0;
  }

  function rateForPeriod(key) {
    if (rates.has(key)) return rates.get(key);
    if (key > lastOfficialPeriod) {
      carriedForward = true;
      carriedForwardFrom = lastOfficialPeriod;
      carriedForwardThrough = key;
      return lastOfficialRate;
    }
    throw new Error(`Für ${key} fehlen ${seriesLabel} innerhalb der ECB-Datenreihe.`);
  }

  function accrueUntil(targetDate) {
    const target = parseIsoDate(targetDate);
    while (cursor < target) {
      const monthBoundary = nextMonthBoundary(cursor);
      const yearBoundary = nextYearBoundary(cursor);
      let stop = target;
      if (monthBoundary < stop) stop = monthBoundary;
      if (yearBoundary < stop) stop = yearBoundary;

      const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
      const annualRate = rateForPeriod(key) / 100;
      const days = Math.round((stop - cursor) / MS_PER_DAY);
      accruedGrossInterest += balance * annualRate * (days / 365);
      cursor = stop;

      if (cursor.getUTCMonth() === 0 && cursor.getUTCDate() === 1) {
        creditInterest();
      }
    }
  }

  for (const flow of flows) {
    if (flow.date > endDate) continue;
    if (!Number.isFinite(flow.amount)) throw new Error("Ungültiger Zahlungsstrom im historischen Vergleich.");
    accrueUntil(flow.date);
    balance += -flow.amount;
    if (balance < -0.005) {
      throw new Error(`Der historische Vergleich würde am ${flow.date} ins Minus geraten.`);
    }
    if (Math.abs(balance) < 0.005) balance = 0;
  }

  accrueUntil(endDate);
  creditInterest();

  return {
    balance,
    grossInterest: totalGrossInterest,
    tax: totalTax,
    startDate,
    endDate,
    taxRate,
    rateCoverage: {
      firstOfficialPeriod,
      lastOfficialPeriod,
      requiredEndPeriod,
      carriedForward,
      carriedForwardFrom,
      carriedForwardThrough: carriedForward ? requiredEndPeriod : null,
      carriedRate: carriedForward ? lastOfficialRate : null
    }
  };
}

export function simulateHistoricalSavings(options) {
  return simulateHistoricalRateBenchmark({
    ...options,
    seriesLabel: options?.seriesLabel || "historische Spareinlagen-Zinsen"
  });
}

export function summarizeCashflows(cashflows) {
  const result = {
    outflows: 0,
    inflows: 0,
    net: 0,
    count: 0
  };
  for (const item of cashflows ?? []) {
    const amount = Number(item.amount);
    if (!Number.isFinite(amount)) continue;
    result.count += 1;
    result.net += amount;
    if (amount < 0) result.outflows += -amount;
    if (amount > 0) result.inflows += amount;
  }
  return result;
}
