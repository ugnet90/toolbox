export const BUNDESSCHATZ_KEST = 0.275;
export const SPAREINLAGE_KEST = 0.25;

const DAY_MS = 86_400_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function datePartsToIso({ year, month, day }) {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

export function parseIsoDate(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new Error(`Ungültiges Datum: ${value}`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Ungültiges Datum: ${value}`);
  }
  return date;
}

export function formatIsoDate(value) {
  const date = parseIsoDate(value);
  return new Intl.DateTimeFormat("de-AT", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

export function viennaDateTimeParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
}

function normalizeInterval(interval) {
  const value = String(interval ?? "").trim().toUpperCase();
  const map = {
    D: "D",
    DAY: "D",
    DAYS: "D",
    TAG: "D",
    TAGE: "D",
    W: "W",
    WEEK: "W",
    WEEKS: "W",
    WOCHE: "W",
    WOCHEN: "W",
    M: "M",
    MONTH: "M",
    MONTHS: "M",
    MONAT: "M",
    MONATE: "M",
    Y: "Y",
    YEAR: "Y",
    YEARS: "Y",
    JAHR: "Y",
    JAHRE: "Y"
  };
  return map[value] ?? value;
}

export function formatTerm(periodValue, periodInterval) {
  const value = Number(periodValue);
  const interval = normalizeInterval(periodInterval);
  const labels = {
    D: value === 1 ? "Tag" : "Tage",
    W: value === 1 ? "Woche" : "Wochen",
    M: value === 1 ? "Monat" : "Monate",
    Y: value === 1 ? "Jahr" : "Jahre"
  };
  return `${value} ${labels[interval] ?? periodInterval}`;
}

function approximateDays(periodValue, periodInterval) {
  const value = Number(periodValue);
  switch (normalizeInterval(periodInterval)) {
    case "D": return value;
    case "W": return value * 7;
    case "M": return value * 30.4375;
    case "Y": return value * 365.25;
    default: return Number.POSITIVE_INFINITY;
  }
}

export function normalizeProducts(payload) {
  const rawProducts = payload?.data;
  if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
    throw new Error("Die Bundesschatz-Schnittstelle liefert keine Produkte.");
  }

  return rawProducts.map((product) => {
    const info = product?.productDisplayInfo;
    if (!info || !Array.isArray(product?.interestRates)) return null;

    const periodValue = Number(info.periodValue);
    const periodInterval = normalizeInterval(info.periodInterval);
    if (!info.productKey || !Number.isFinite(periodValue) || periodValue <= 0) return null;
    if (!(["D", "W", "M", "Y"].includes(periodInterval))) return null;

    const rates = product.interestRates
      .filter((rate) => DATE_PATTERN.test(rate?.date ?? "") && Number.isFinite(Number(rate?.interestRate)))
      .map((rate) => ({ date: rate.date, interestRate: Number(rate.interestRate) }));

    if (!rates.length) return null;

    return {
      productKey: String(info.productKey),
      periodInterval,
      periodValue,
      green: Boolean(info.green),
      label: formatTerm(periodValue, periodInterval),
      rates
    };
  }).filter(Boolean);
}

export function chooseValueDate(products, now = new Date()) {
  const { date: today, hour } = viennaDateTimeParts(now);
  const allDates = [...new Set(products.flatMap((product) => product.rates.map((rate) => rate.date)))].sort();
  if (!allDates.length) throw new Error("Keine Zinssatz-Datumswerte vorhanden.");

  // Bundesschatz: bis 12:00 Uhr aktueller Valutatag, danach nächster Bankarbeitstag.
  if (hour < 12 && allDates.includes(today)) return today;

  const futureDates = allDates.filter((date) => hour >= 12 ? date > today : date >= today);
  if (futureDates.length) return futureDates[0];

  return allDates[allDates.length - 1];
}

export function productsForValueDate(products, valueDate) {
  return products
    .map((product) => {
      const rate = product.rates.find((item) => item.date === valueDate);
      return rate ? { ...product, interestRate: rate.interestRate, valueDate } : null;
    })
    .filter(Boolean)
    .sort((a, b) => approximateDays(a.periodValue, a.periodInterval) - approximateDays(b.periodValue, b.periodInterval));
}

function daysInUtcMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addUtcMonths(date, months) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const targetIndex = month + months;
  const targetYear = year + Math.floor(targetIndex / 12);
  const targetMonth = ((targetIndex % 12) + 12) % 12;
  const targetDay = Math.min(day, daysInUtcMonth(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth, targetDay));
}

export function maturityDate(valueDate, periodValue, periodInterval) {
  const start = parseIsoDate(valueDate);
  const value = Number(periodValue);
  const interval = normalizeInterval(periodInterval);
  let end;

  switch (interval) {
    case "D":
      end = new Date(start.getTime() + value * DAY_MS);
      break;
    case "W":
      end = new Date(start.getTime() + value * 7 * DAY_MS);
      break;
    case "M":
      end = addUtcMonths(start, value);
      break;
    case "Y":
      end = addUtcMonths(start, value * 12);
      break;
    default:
      throw new Error(`Nicht unterstützte Laufzeiteinheit: ${periodInterval}`);
  }

  return datePartsToIso({
    year: end.getUTCFullYear(),
    month: end.getUTCMonth() + 1,
    day: end.getUTCDate()
  });
}

export function actualDays(startIso, endIso) {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  return Math.round((end.getTime() - start.getTime()) / DAY_MS);
}

export function bundesschatzNetFactor({ valueDate, maturityDate: endIso, interestRate }) {
  const start = parseIsoDate(valueDate);
  const end = parseIsoDate(endIso);
  const oneYearLater = addUtcMonths(start, 12);
  const days = actualDays(valueDate, endIso);
  const rate = Number(interestRate) / 100;

  if (!(rate >= 0) || days <= 0) throw new Error("Ungültige Bundesschatz-Berechnungsdaten.");

  const grossReturn = end.getTime() <= oneYearLater.getTime()
    ? rate * days / 365
    : Math.pow(1 + rate, days / 365) - 1;

  const netReturn = grossReturn * (1 - BUNDESSCHATZ_KEST);
  return { factor: 1 + netReturn, grossReturn, netReturn, days };
}

export function days360(startIso, endIso) {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  const y1 = start.getUTCFullYear();
  const y2 = end.getUTCFullYear();
  const m1 = start.getUTCMonth() + 1;
  const m2 = end.getUTCMonth() + 1;
  const d1 = Math.min(start.getUTCDate(), 30);
  const d2 = Math.min(end.getUTCDate(), 30);
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
}

function nextCalendarYearStart(iso) {
  const date = parseIsoDate(iso);
  return `${date.getUTCFullYear() + 1}-01-01`;
}

export function bankNetFactor(rateDecimal, startIso, endIso) {
  if (!Number.isFinite(rateDecimal) || rateDecimal < 0) {
    throw new Error("Ungültiger Bankzinssatz.");
  }
  if (actualDays(startIso, endIso) < 14) {
    return 1;
  }

  let balance = 1;
  let segmentStart = startIso;

  while (segmentStart < endIso) {
    const yearBoundary = nextCalendarYearStart(segmentStart);
    const segmentEnd = yearBoundary < endIso ? yearBoundary : endIso;
    const dayCount = days360(segmentStart, segmentEnd);

    if (dayCount > 0) {
      const grossInterest = balance * rateDecimal * dayCount / 360;
      balance += grossInterest * (1 - SPAREINLAGE_KEST);
    }

    segmentStart = segmentEnd;
  }

  return balance;
}

export function solveBankRate(targetFactor, startIso, endIso) {
  if (!Number.isFinite(targetFactor) || targetFactor < 1) {
    throw new Error("Ungültiger Ziel-Endbetrag.");
  }
  if (targetFactor === 1) return 0;
  if (actualDays(startIso, endIso) < 14) return null;

  let low = 0;
  let high = 0.25;
  while (bankNetFactor(high, startIso, endIso) < targetFactor && high < 10) {
    high *= 2;
  }
  if (bankNetFactor(high, startIso, endIso) < targetFactor) {
    throw new Error("Kein Vergleichszinssatz im unterstützten Bereich gefunden.");
  }

  for (let i = 0; i < 100; i += 1) {
    const mid = (low + high) / 2;
    if (bankNetFactor(mid, startIso, endIso) >= targetFactor) high = mid;
    else low = mid;
  }
  return high;
}

export function calculateComparison(product) {
  const endIso = maturityDate(product.valueDate, product.periodValue, product.periodInterval);
  const bundesschatz = bundesschatzNetFactor({
    valueDate: product.valueDate,
    maturityDate: endIso,
    interestRate: product.interestRate
  });
  const bankRate = solveBankRate(bundesschatz.factor, product.valueDate, endIso);

  return {
    maturityDate: endIso,
    bundesschatz,
    bankRate,
    bankFactor: bankRate === null ? null : bankNetFactor(bankRate, product.valueDate, endIso)
  };
}

export function ceilPercentToHundredth(rateDecimal) {
  return Math.ceil((rateDecimal * 100) * 100 - 1e-10) / 100;
}
