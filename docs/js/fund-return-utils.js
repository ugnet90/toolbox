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

export const FUND_RETURN_DATA_FORMAT = "toolbox-depot-return";
export const FUND_RETURN_DATA_SCHEMA_VERSION = 2;

const LEGACY_FUND_RETURN_DATA_FORMAT = "toolbox-fund-return";
const FUND_AMOUNT_MODES = new Set(["gross", "net"]);
const DEPOT_BENCHMARK_KEYS = ["overnight", "euribor3m", "euribor6m", "euribor12m"];
const DEPOT_BENCHMARK_SET = new Set(DEPOT_BENCHMARK_KEYS);
const FUND_KEST_MODES = new Set(["no", "yes"]);
const FUND_CASHFLOW_TYPES = new Set(["contribution", "distribution", "tax", "fee", "withdrawal", "other"]);

function requireFiniteNumber(value, label, { min = -Infinity, max = Infinity, greaterThan = null } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} ist ungültig.`);
  if (greaterThan !== null && !(number > greaterThan)) throw new Error(`${label} muss größer als ${greaterThan} sein.`);
  if (number < min || number > max) throw new Error(`${label} liegt außerhalb des erlaubten Bereichs.`);
  return number;
}

function legacyBenchmarkKinds(value) {
  const mode = String(value ?? "");
  if (mode === "both") return ["overnight", "euribor3m"];
  if (DEPOT_BENCHMARK_SET.has(mode)) return [mode];
  if (mode === "none" || !mode) return [];
  throw new Error("Ungültige Benchmark-Auswahl.");
}

function normalizeBenchmarkKinds(inputs) {
  if (!Array.isArray(inputs?.benchmarkKinds)) return legacyBenchmarkKinds(inputs?.historicalCompare);
  const unique = [];
  for (const raw of inputs.benchmarkKinds) {
    const key = String(raw ?? "");
    if (!DEPOT_BENCHMARK_SET.has(key)) throw new Error(`Unbekannter Benchmark: ${key || "leer"}.`);
    if (!unique.includes(key)) unique.push(key);
  }
  return unique;
}

export function normalizeFundReturnData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Die Importdatei enthält keine gültigen Depotrendite-Daten.");
  }

  const isLegacy = payload.format === LEGACY_FUND_RETURN_DATA_FORMAT && Number(payload.schema_version) === 1;
  const isCurrent = payload.format === FUND_RETURN_DATA_FORMAT && Number(payload.schema_version) === FUND_RETURN_DATA_SCHEMA_VERSION;
  if (!isLegacy && !isCurrent) {
    throw new Error("Die Datei ist keine unterstützte Toolbox-Depotrendite-Datei.");
  }

  const inputs = payload.inputs;
  if (!inputs || typeof inputs !== "object" || Array.isArray(inputs)) {
    throw new Error("Die Importdatei enthält keine vollständigen Eingabedaten.");
  }

  parseIsoDate(inputs.purchaseDate);
  parseIsoDate(inputs.endDate);
  const initialAmount = requireFiniteNumber(inputs.initialAmount, "Startbetrag", { greaterThan: 0 });
  const purchaseFee = requireFiniteNumber(inputs.purchaseFeePercent, "Kaufspesen", { min: 0, max: 100 });
  const endValue = requireFiniteNumber(inputs.endValue, "End-/Verkaufswert", { min: 0 });
  const initialAmountMode = String(inputs.initialAmountMode ?? "");
  const kestExemption = String(inputs.kestExemption ?? "");
  const benchmarkKinds = normalizeBenchmarkKinds(inputs);
  const designation = String(inputs.designation ?? "").trim();

  if (!FUND_AMOUNT_MODES.has(initialAmountMode)) throw new Error("Ungültige Angabe bei ‚Startbetrag ist‘.");
  if (!FUND_KEST_MODES.has(kestExemption)) throw new Error("Ungültige Angabe zur KESt-Befreiung.");
  if (designation.length > 100) throw new Error("Die Bezeichnung ist zu lang.");

  const rawCashflows = payload.cashflows ?? [];
  if (!Array.isArray(rawCashflows)) throw new Error("Die Zahlungsströme sind ungültig.");
  if (rawCashflows.length > 5000) throw new Error("Die Importdatei enthält zu viele Zahlungsströme.");

  const cashflows = [];
  rawCashflows.forEach((flow, index) => {
    if (!flow || typeof flow !== "object" || Array.isArray(flow)) {
      throw new Error(`Zahlungsstrom ${index + 1} ist ungültig.`);
    }
    parseIsoDate(flow.date);
    const type = String(flow.type ?? "");
    if (!FUND_CASHFLOW_TYPES.has(type)) throw new Error(`Zahlungsstrom ${index + 1} hat eine unbekannte Art.`);
    const amount = requireFiniteNumber(flow.amount, `Betrag in Zahlungsstrom ${index + 1}`);
    if (amount === 0) return;
    const title = String(flow.title ?? "").trim();
    const note = String(flow.note ?? "").trim();
    if (title.length > 120) throw new Error(`Titel in Zahlungsstrom ${index + 1} ist zu lang.`);
    if (note.length > 120) throw new Error(`Notiz in Zahlungsstrom ${index + 1} ist zu lang.`);
    cashflows.push({ date: String(flow.date), type, amount, title, note });
  });

  return {
    inputs: {
      designation,
      purchaseDate: String(inputs.purchaseDate),
      initialAmount,
      initialAmountMode,
      purchaseFeePercent: purchaseFee,
      endDate: String(inputs.endDate),
      endValue,
      benchmarkKinds,
      kestExemption
    },
    cashflows
  };
}

export function createFundReturnData({ inputs, cashflows = [], toolboxVersion = "", exportedAt = "" }) {
  const normalized = normalizeFundReturnData({
    format: FUND_RETURN_DATA_FORMAT,
    schema_version: FUND_RETURN_DATA_SCHEMA_VERSION,
    inputs,
    cashflows
  });

  return {
    format: FUND_RETURN_DATA_FORMAT,
    schema_version: FUND_RETURN_DATA_SCHEMA_VERSION,
    toolbox_version: String(toolboxVersion || ""),
    exported_at: String(exportedAt || ""),
    inputs: normalized.inputs,
    cashflows: normalized.cashflows
  };
}


function parseSemicolonCsv(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ";") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("Die CSV-Datei enthält ein nicht geschlossenes Anführungszeichen.");
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function normalizeCsvHeader(value) {
  return String(value ?? "").replace(/\u00A0/g, " ").trim().toLocaleLowerCase("de-AT");
}

function germanDateToIso(value, lineNumber) {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(String(value ?? "").trim());
  if (!match) throw new Error(`CSV-Zeile ${lineNumber}: Abrechnungsdatum ist ungültig.`);
  const iso = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  parseIsoDate(iso);
  return iso;
}

function mapCsvBusinessType(value) {
  const raw = String(value ?? "").trim();
  const normalized = raw.toLocaleLowerCase("de-AT");
  if (normalized.includes("kauf")) return "contribution";
  if (normalized.includes("verkauf")) return "withdrawal";
  if (normalized.includes("ausschütt") || normalized.includes("ausschuett")) return "distribution";
  if (normalized.includes("kest") || normalized.includes("steuer") || normalized.includes("ausschüttungsgleich") || normalized.includes("ausschuettungsgleich")) return "tax";
  if (normalized.includes("gebühr") || normalized.includes("gebuehr") || normalized.includes("spesen")) return "fee";
  return "other";
}

export function parseBankTransactionsCsv(text) {
  const rows = parseSemicolonCsv(text);
  const nonEmptyRows = rows.filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""));
  if (nonEmptyRows.length < 2) throw new Error("Die CSV-Datei enthält keine Buchungsdaten.");

  const header = nonEmptyRows[0].map(normalizeCsvHeader);
  const required = {
    amount: "abrechnungsbetrag",
    type: "geschäftsart",
    date: "abrechnungsdatum"
  };
  const indexes = Object.fromEntries(
    Object.entries(required).map(([key, label]) => [key, header.indexOf(label)])
  );
  const titleIndex = header.indexOf("titel");
  const missing = Object.entries(indexes).filter(([, index]) => index < 0).map(([key]) => required[key]);
  if (missing.length) throw new Error(`CSV-Spalte(n) fehlen: ${missing.join(", ")}.`);

  const cashflows = [];
  let unknownBusinessTypes = 0;
  let normalizedOutflowSigns = 0;
  let skippedZeroAmounts = 0;

  for (let index = 1; index < nonEmptyRows.length; index += 1) {
    const row = nonEmptyRows[index];
    const lineNumber = index + 1;
    const rawAmount = String(row[indexes.amount] ?? "").trim();
    const businessType = String(row[indexes.type] ?? "").trim();
    const rawDate = String(row[indexes.date] ?? "").trim();
    const title = titleIndex >= 0 ? String(row[titleIndex] ?? "").trim() : "";
    if (!rawAmount && !businessType && !rawDate && !title) continue;
    if (!rawAmount || !rawDate) throw new Error(`CSV-Zeile ${lineNumber}: Abrechnungsbetrag oder Abrechnungsdatum fehlt.`);

    let amount = parseGermanNumber(rawAmount);
    if (!Number.isFinite(amount)) throw new Error(`CSV-Zeile ${lineNumber}: Abrechnungsbetrag ist ungültig.`);
    if (amount === 0) {
      skippedZeroAmounts += 1;
      continue;
    }

    const type = mapCsvBusinessType(businessType);
    if (type === "other") unknownBusinessTypes += 1;
    if (["contribution", "tax", "fee"].includes(type) && amount > 0) {
      amount = -amount;
      normalizedOutflowSigns += 1;
    }

    cashflows.push({
      date: germanDateToIso(rawDate, lineNumber),
      type,
      amount,
      title: title.slice(0, 120),
      note: businessType.slice(0, 120)
    });
  }

  if (!cashflows.length && skippedZeroAmounts === 0) throw new Error("Die CSV-Datei enthält keine importierbaren Buchungen.");
  if (cashflows.length > 5000) throw new Error("Die CSV-Datei enthält zu viele Buchungen.");
  return { cashflows, unknownBusinessTypes, normalizedOutflowSigns, skippedZeroAmounts, hasTitleColumn: titleIndex >= 0 };
}

function monthSerial(isoDate) {
  const date = parseIsoDate(isoDate);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function median(values) {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

export function detectRecurringSavingsPlans(cashflows, tolerancePercent = 1.1) {
  const groups = new Map();
  for (const flow of cashflows ?? []) {
    if (flow?.type !== "contribution") continue;
    const title = String(flow?.title ?? "").trim();
    const amount = Math.abs(Number(flow?.amount));
    if (!title || !Number.isFinite(amount) || amount <= 0) continue;
    try { parseIsoDate(flow.date); } catch { continue; }
    const key = title.toLocaleLowerCase("de-AT");
    if (!groups.has(key)) groups.set(key, { title, flows: [] });
    groups.get(key).flows.push({ date: String(flow.date), amount });
  }

  const plans = [];
  for (const group of groups.values()) {
    const flows = group.flows.sort((a, b) => a.date.localeCompare(b.date));
    if (flows.length < 3) continue;

    const consecutiveGaps = [];
    for (let i = 1; i < flows.length; i += 1) {
      consecutiveGaps.push(monthSerial(flows[i].date) - monthSerial(flows[i - 1].date));
    }
    const monthlyShare = consecutiveGaps.filter((gap) => gap === 1).length / Math.max(consecutiveGaps.length, 1);
    if (monthlyShare < 0.75) continue;

    const amounts = flows.map((flow) => flow.amount);
    const center = median(amounts);
    const nominal = center >= 20 ? Math.round(center) : Math.round(center * 10) / 10;
    if (nominal <= 0) continue;
    const deviations = amounts.map((amount) => Math.abs(amount - nominal) / nominal * 100);
    const withinTolerance = deviations.filter((value) => value <= tolerancePercent).length / deviations.length;
    if (withinTolerance < 0.8) continue;

    plans.push({
      title: group.title,
      nominalAmount: nominal,
      firstDate: flows[0].date,
      lastDate: flows[flows.length - 1].date,
      count: flows.length,
      maxDeviationPercent: Math.max(...deviations),
      cadence: "monthly"
    });
  }

  return plans.sort((a, b) => a.title.localeCompare(b.title, "de-AT"));
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


export function applyKestExemption(cashflows, isExempt = false) {
  const source = Array.isArray(cashflows) ? cashflows.map((item) => ({ ...item })) : [];
  if (!isExempt) {
    return { cashflows: source, ignoredTaxCashflows: [], ignoredTaxNet: 0 };
  }

  const ignoredTaxCashflows = source.filter((item) => item.type === "tax");
  const filtered = source.filter((item) => item.type !== "tax");
  const ignoredTaxNet = ignoredTaxCashflows.reduce((sum, item) => {
    const amount = Number(item.amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);

  return { cashflows: filtered, ignoredTaxCashflows, ignoredTaxNet };
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
