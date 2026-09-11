import {
  effectiveIssueLoadPercent,
  simulateInsuranceFundComparison,
  createInsuranceFundCompareData,
  normalizeInsuranceFundCompareData,
  suggestReturnScenarios
} from "./insurance-fund-compare-utils.js?v=0.7.4";

const TOOLBOX_VERSION = "0.7.4";
const DEPOT_COST_STORAGE_KEY = "toolbox:insurance-fund-compare:depot-costs:v2";
const LEGACY_DEPOT_COST_STORAGE_KEY = "toolbox:insurance-fund-compare:depot-costs:v1";
const INSURANCE_COST_STORAGE_KEY = "toolbox:insurance-fund-compare:insurance-costs:v2";
const LEGACY_INSURANCE_COST_STORAGE_KEY = "toolbox:insurance-fund-compare:insurance-costs:v1";

const form = document.querySelector("[data-ifc-form]");
const resultsHost = document.querySelector("[data-results]");
const errorHost = document.querySelector("[data-error]");
const importFile = document.querySelector("[data-import-file]");

const PRODUCT_PRESETS = {
  ergo_investment: {
    minimum: 30000,
    tax: 4,
    entryCost: 5,
    entryYears: 5,
    adminPremium: 0,
    adminAsset: 0.3,
    riskAnnual: 0,
    hint: "Mindest-Einmalprämie 30.000,00 €. Abschlusskosten 5 % der Netto-Einmalprämie, gleichmäßig über fünf Jahre; laufende Verwaltung 0,3 % p.a. der Deckungsrückstellung. Risikokosten laut Vertrag."
  },
  ergo_life: {
    minimum: 5000,
    tax: 4,
    entryCost: 5.5,
    entryYears: 5,
    adminPremium: 0.15,
    adminAsset: 0.10,
    riskAnnual: 0,
    hint: "Mindest-Einmalprämie 5.000,00 €. Abschlusskosten 5,5 % der Netto-Einmalprämie, gleichmäßig über fünf Jahre; Verwaltung 0,15 % p.a. der Netto-Einmalprämie plus 0,10 % p.a. des Vermögens. Risikokosten laut Vertrag."
  },
  custom: {
    minimum: 0,
    tax: 4,
    entryCost: "",
    entryYears: 5,
    adminPremium: "",
    adminAsset: "",
    riskAnnual: 0,
    hint: "Alle Kosten und die Mindestprämie individuell erfassen. Gespeichert werden die Kostenwerte getrennt für dieses Produkt."
  }
};

function ensureInsuranceAdminFieldsCompatibility() {
  if (el("insuranceAdminPremiumPercent") && el("insuranceAdminAssetPercent")) return;
  const legacy = el("insuranceAdminPercent");
  if (!legacy) return;
  const legacyField = legacy.closest(".field");
  const grid = legacyField?.parentElement;
  if (!legacyField || !grid) return;
  const product = el("insuranceProduct")?.value || "ergo_investment";
  const preset = PRODUCT_PRESETS[product] || PRODUCT_PRESETS.custom;
  const legacyValue = Number(legacy.value);
  const premiumValue = Number.isFinite(Number(preset.adminPremium)) ? preset.adminPremium : 0;
  const assetValue = Number.isFinite(Number(preset.adminAsset)) ? preset.adminAsset : (Number.isFinite(legacyValue) ? legacyValue : 0);
  const premiumField = document.createElement("div");
  premiumField.className = "field";
  premiumField.innerHTML = `<label for="insuranceAdminPremiumPercent">Verwaltung auf Netto-Einmalprämie <span class="ifc-saved-badge">wird gespeichert</span></label><div class="ifc-input-suffix"><input id="insuranceAdminPremiumPercent" name="insuranceAdminPremiumPercent" type="number" min="0" max="20" step="0.01" value="${premiumValue}"><span>% p.a.</span></div>`;
  const assetField = document.createElement("div");
  assetField.className = "field";
  assetField.innerHTML = `<label for="insuranceAdminAssetPercent">Verwaltung auf Vermögen <span class="ifc-saved-badge">wird gespeichert</span></label><div class="ifc-input-suffix"><input id="insuranceAdminAssetPercent" name="insuranceAdminAssetPercent" type="number" min="0" max="20" step="0.01" value="${assetValue}"><span>% p.a.</span></div>`;
  legacyField.replaceWith(premiumField, assetField);
}

ensureInsuranceAdminFieldsCompatibility();

const FUND_PALETTE_URL = `data/ergo_union_funds.json?v=${TOOLBOX_VERSION}`;
const DATA_PROXY = "https://toolbox-bundesschatz-proxy.daniel-koechler.workers.dev";
const FUND_PALETTE_STALE_DAYS = 60;
const FUND_UPDATE_WORKFLOW_URL = "https://github.com/ugnet90/toolbox/actions/workflows/update-ergo-fund-palette.yml";
const RETURN_FALLBACK_CACHE_KEY = "toolbox:insurance-fund-compare:return-fallback:v1";
const RETURN_FALLBACK_CACHE_DAYS = 7;
const STANDARD_RETURN_PERIODS = [20, 15, 10, 5, 3, 1];

let fundProfiles = [];
let fundPaletteSource = null;
let returnAssumption = { mode: "manual", profile: null };
let activeInsuranceProduct = "ergo_investment";
let historicalRequestSequence = 0;

function el(id) { return document.getElementById(id); }

function parseGermanNumber(value) {
  let normalized = String(value ?? "").trim().replace(/[\s']/g, "");
  if (!normalized) return NaN;
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot ? normalized.replace(/\./g, "").replace(",", ".") : normalized.replace(/,/g, "");
  } else if (comma >= 0) {
    normalized = normalized.replace(",", ".");
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }
  return Number(normalized);
}

function money(value) {
  return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR", useGrouping: true, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function pct(value, digits = 2) {
  return `${new Intl.NumberFormat("de-AT", { useGrouping: true, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value) || 0)} %`;
}

function numberDe(value, digits = 2) {
  return new Intl.NumberFormat("de-AT", { useGrouping: true, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Number(value) || 0);
}

function formatAmountInput(input) {
  const value = parseGermanNumber(input.value);
  if (!Number.isFinite(value)) return;
  input.value = numberDe(value, 2);
}

function numericValue(id, { allowBlank = false } = {}) {
  const node = el(id);
  const raw = node?.value ?? "";
  if (allowBlank && String(raw).trim() === "") return null;
  const value = node?.type === "text" ? parseGermanNumber(raw) : Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${node?.labels?.[0]?.textContent?.trim() || id} ist ungültig.`);
  return value;
}

function collectInputs() {
  const product = el("insuranceProduct").value;
  const entryCost = numericValue("insuranceEntryCostPercent", { allowBlank: true });
  const adminPremiumCost = numericValue("insuranceAdminPremiumPercent", { allowBlank: true });
  const adminAssetCost = numericValue("insuranceAdminAssetPercent", { allowBlank: true });
  if (entryCost === null) throw new Error("Bitte die Abschlusskosten der gewählten Versicherung eintragen.");
  if (adminPremiumCost === null) throw new Error("Bitte die Verwaltungskosten auf die Netto-Einmalprämie eintragen.");
  if (adminAssetCost === null) throw new Error("Bitte die Verwaltungskosten auf das Vermögen eintragen.");

  return {
    product,
    fundName: el("fundName").value.trim(),
    fundIsin: el("fundIsin").value.trim().toUpperCase(),
    amount: numericValue("amount"),
    years: numericValue("years"),
    grossReturnPercent: numericValue("grossReturnPercent"),
    returnAssumptionMode: returnAssumption.mode,
    historicalReturnPercent: returnAssumption.profile?.historicalReturnPercent ?? null,
    historicalReturnStand: returnAssumption.mode === "historical" ? (returnAssumption.profile?.historicalStand || "") : "",
    insuranceTaxPercent: numericValue("insuranceTaxPercent"),
    insuranceMinimumAmount: numericValue("insuranceMinimumAmount"),
    insuranceEntryCostPercent: entryCost,
    insuranceEntryCostYears: numericValue("insuranceEntryCostYears"),
    insuranceAdminPremiumPercent: adminPremiumCost,
    insuranceAdminAssetPercent: adminAssetCost,
    insuranceRiskAnnual: numericValue("insuranceRiskAnnual"),
    age50Plus: el("age50Plus").checked,
    personalTaxPercent: numericValue("personalTaxPercent"),
    issueLoadPercent: numericValue("issueLoadPercent"),
    issueLoadDiscountPercent: numericValue("issueLoadDiscountPercent"),
    depotFeePercent: numericValue("depotFeePercent"),
    depotFeeAnnual: numericValue("depotFeeAnnual"),
    capitalGainsTaxPercent: numericValue("capitalGainsTaxPercent"),
    directTaxMode: el("directTaxMode").value,
    annualTaxableYieldPercent: numericValue("annualTaxableYieldPercent")
  };
}

function setError(message = "") {
  if (!message) {
    errorHost.hidden = true;
    errorHost.textContent = "";
    return;
  }
  errorHost.hidden = false;
  errorHost.textContent = message;
}

function setFormattedMinimum(value) {
  el("insuranceMinimumAmount").value = numberDe(value, 2);
}

function readInsuranceCostDefaults() {
  try {
    const raw = localStorage.getItem(INSURANCE_COST_STORAGE_KEY) || localStorage.getItem(LEGACY_INSURANCE_COST_STORAGE_KEY) || "null";
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result = {};
    for (const product of Object.keys(PRODUCT_PRESETS)) {
      const values = parsed[product];
      if (values && typeof values === "object" && !Array.isArray(values)) result[product] = values;
    }
    return result;
  } catch {
    return {};
  }
}

function insuranceCostValuesFromForm() {
  const entryCost = Number(el("insuranceEntryCostPercent").value);
  const entryYears = Number(el("insuranceEntryCostYears").value);
  const adminPremium = Number(el("insuranceAdminPremiumPercent").value);
  const adminAsset = Number(el("insuranceAdminAssetPercent").value);
  const riskAnnual = parseGermanNumber(el("insuranceRiskAnnual").value);
  if (![entryCost, entryYears, adminPremium, adminAsset, riskAnnual].every(Number.isFinite)) return null;
  return { entryCost, entryYears, adminPremium, adminAsset, riskAnnual };
}

function saveInsuranceCostDefaults(product = el("insuranceProduct").value) {
  try {
    const values = insuranceCostValuesFromForm();
    if (!values || !product) return;
    const all = readInsuranceCostDefaults();
    all[product] = values;
    localStorage.setItem(INSURANCE_COST_STORAGE_KEY, JSON.stringify(all));
  } catch { /* localStorage kann im Browser deaktiviert sein */ }
}

function applyInsuranceCostValues(values, preset = null) {
  const fallback = preset || {};
  el("insuranceEntryCostPercent").value = values?.entryCost ?? fallback.entryCost ?? "";
  el("insuranceEntryCostYears").value = values?.entryYears ?? fallback.entryYears ?? 5;
  el("insuranceAdminPremiumPercent").value = values?.adminPremium ?? fallback.adminPremium ?? 0;
  el("insuranceAdminAssetPercent").value = values?.adminAsset ?? fallback.adminAsset ?? 0;
  el("insuranceRiskAnnual").value = numberDe(Number(values?.riskAnnual ?? fallback.riskAnnual ?? 0) || 0, 2);
}

function updateProductPreset({ preserveManual = false } = {}) {
  const product = el("insuranceProduct").value;
  const preset = PRODUCT_PRESETS[product];
  if (!preset) return;
  if (!preserveManual) {
    setFormattedMinimum(preset.minimum);
    el("insuranceTaxPercent").value = preset.tax;
    const saved = readInsuranceCostDefaults()[product];
    applyInsuranceCostValues(saved, preset);
  }
  document.querySelector("[data-product-hint]").textContent = preset.hint;
  updateShortTermWarning();
}

function updateShortTermWarning() {
  const years = Number(el("years").value);
  const minYears = el("age50Plus").checked ? 10 : 15;
  const warning = document.querySelector("[data-short-term-warning]");
  const text = document.querySelector("[data-short-term-text]");
  const show = Number.isFinite(years) && years < minYears && Number(el("insuranceTaxPercent").value) < 11;
  warning.hidden = !show;
  if (show) text.textContent = `Bei einer Auszahlung nach ${years} Jahr(en) liegt die Modelllaufzeit unter ${minYears} Jahren. Der Rechner berücksichtigt deshalb 7 % zusätzliche Versicherungssteuer; eine mögliche Differenz-ESt wird mit dem unten eingegebenen persönlichen Steuersatz modelliert.`;
}

function updateDirectTaxFields() {
  document.querySelector("[data-annual-taxable-yield-field]").hidden = el("directTaxMode").value !== "annual_proxy";
}

function updateEffectiveIssueLoad() {
  try {
    const effective = effectiveIssueLoadPercent(Number(el("issueLoadPercent").value), Number(el("issueLoadDiscountPercent").value));
    document.querySelector("[data-effective-issue-load]").textContent = pct(effective);
  } catch {
    document.querySelector("[data-effective-issue-load]").textContent = "–";
  }
}

function updateOekbLink() {
  const isin = el("fundIsin").value.trim().toUpperCase();
  const link = document.querySelector("[data-oekb-link]");
  link.href = /^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)
    ? `https://my.oekb.at/kapitalmarkt-services/kms-output/fonds-info/sd/af/f?isin=${encodeURIComponent(isin)}`
    : "https://my.oekb.at/kapitalmarkt-services/kms-output/fonds-info/sd/af/f";
}

function normalizeFundName(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("de-AT")
    .replace(/[:]/g, " ")
    .replace(/\s+/g, " ");
}

function formatIsoDateDe(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  return match ? `${match[3]}.${match[2]}.${match[1]}` : String(value || "");
}

function normalizeFundProfile(raw) {
  const name = String(raw?.name || "").trim();
  const isin = String(raw?.isin || "").trim().toUpperCase();
  const aliases = Array.isArray(raw?.aliases) ? raw.aliases.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const issueLoad = raw?.issue_load_percent === null || raw?.issue_load_percent === undefined
    ? null
    : Number(raw.issue_load_percent);
  return {
    name,
    isin,
    aliases,
    issueLoadPercent: Number.isFinite(issueLoad) ? issueLoad : null,
    issueLoadSource: String(raw?.issue_load_source || "").trim(),
    performance: raw?.performance && typeof raw.performance === "object" ? raw.performance : null,
    searchNames: [name, ...aliases].map(normalizeFundName).filter(Boolean)
  };
}

function populateFundDatalists() {
  const nameList = el("ifcFundNameOptions");
  const isinList = el("ifcFundIsinOptions");
  if (!nameList || !isinList) return;
  nameList.replaceChildren(...fundProfiles.map((profile) => {
    const option = document.createElement("option");
    option.value = profile.name;
    option.label = profile.isin;
    return option;
  }));
  isinList.replaceChildren(...fundProfiles.map((profile) => {
    const option = document.createElement("option");
    option.value = profile.isin;
    option.label = profile.name;
    return option;
  }));
}

function paletteAgeDays(checkedAt) {
  const timestamp = Date.parse(`${checkedAt || ""}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

function renderFundPaletteStatus(error = null) {
  const host = document.querySelector("[data-fund-palette-status]");
  if (!host) return;
  host.classList.remove("is-stale", "is-error");
  if (error) {
    host.classList.add("is-error");
    host.textContent = `ERGO-Fondspalette konnte nicht geladen werden: ${error}`;
    return;
  }
  const checkedAt = String(fundPaletteSource?.checked_at || "");
  const sourceAt = String(fundPaletteSource?.source_updated_at || "");
  const age = paletteAgeDays(checkedAt);
  const base = `ERGO-Fondspalette: ${fundProfiles.length} Union-Fonds · Quelle Stand ${formatIsoDateDe(sourceAt) || "unbekannt"} · zuletzt geprüft ${formatIsoDateDe(checkedAt) || "unbekannt"}.`;
  if (age !== null && age > FUND_PALETTE_STALE_DAYS) {
    host.classList.add("is-stale");
    host.innerHTML = `${base} <strong>Seit ${age} Tagen nicht geprüft.</strong> Eine manuelle Aktualisierung über <a href="${FUND_UPDATE_WORKFLOW_URL}" target="_blank" rel="noopener">GitHub Actions → Update ERGO fund palette</a> wird empfohlen.`;
  } else {
    host.textContent = base;
  }
}

async function loadFundPalette() {
  try {
    const response = await fetch(FUND_PALETTE_URL, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.funds)) throw new Error("ungültiges Datenformat");
    fundProfiles = payload.funds.map(normalizeFundProfile).filter((item) => item.name && /^[A-Z]{2}[A-Z0-9]{10}$/.test(item.isin));
    fundPaletteSource = payload.source || null;
    populateFundDatalists();
    renderFundPaletteStatus();
  } catch (error) {
    fundProfiles = [];
    fundPaletteSource = null;
    renderFundPaletteStatus(error instanceof Error ? error.message : String(error));
  }
}

function findFundByName(name) {
  const normalized = normalizeFundName(name);
  if (!normalized) return null;
  const exact = fundProfiles.find((profile) => profile.searchNames.includes(normalized));
  if (exact) return exact;
  if (normalized.length < 4) return null;
  const candidates = fundProfiles.filter((profile) => profile.searchNames.some((candidate) => candidate.startsWith(normalized)));
  return candidates.length === 1 ? candidates[0] : null;
}

function findFundByIsin(isin) {
  const normalized = String(isin || "").trim().toUpperCase();
  if (!normalized) return null;
  const exact = fundProfiles.find((profile) => profile.isin === normalized);
  if (exact) return exact;
  if (normalized.length < 4) return null;
  const candidates = fundProfiles.filter((profile) => profile.isin.startsWith(normalized));
  return candidates.length === 1 ? candidates[0] : null;
}

function matchFundProfile(preferredField = "") {
  const isin = el("fundIsin").value.trim().toUpperCase();
  const name = el("fundName").value;
  if (preferredField === "name") return findFundByName(name) || (!name.trim() ? findFundByIsin(isin) : null);
  if (preferredField === "isin") return findFundByIsin(isin) || (!isin ? findFundByName(name) : null);
  return findFundByIsin(isin) || findFundByName(name);
}

function renderFundMatchStatus(profile = null) {
  const host = document.querySelector("[data-fund-match-status]");
  if (!host) return;
  if (!profile) {
    host.hidden = true;
    host.textContent = "";
    return;
  }
  host.hidden = false;
  if (Number.isFinite(profile.issueLoadPercent)) {
    const source = profile.issueLoadSource ? ` · Quelle: ${profile.issueLoadSource}` : "";
    host.innerHTML = `<strong>${profile.name}</strong> · ${profile.isin} · regulärer Ausgabeaufschlag ${numberDe(profile.issueLoadPercent, 2)} %${source}`;
  } else {
    host.innerHTML = `<strong>${profile.name}</strong> · ${profile.isin} · Ausgabeaufschlag konnte nicht automatisch ermittelt werden; bitte prüfen.`;
  }
}

function selectStandardizedPerformance(profile, years) {
  const annualized = profile?.performance?.annualized;
  if (!annualized || typeof annualized !== "object") return null;
  const available = Object.entries(annualized)
    .map(([period, value]) => ({ period: Number(period), value: Number(value) }))
    .filter((item) => Number.isFinite(item.period) && Number.isFinite(item.value) && item.period > 0)
    .sort((a, b) => a.period - b.period);
  if (!available.length) return null;
  const term = Number(years);
  const eligible = available.filter((item) => item.period <= term);
  const selected = eligible.length ? eligible.at(-1) : available[0];
  return {
    ...profile,
    historicalReturnPercent: selected.value,
    historicalPeriod: `${selected.period} Jahr${selected.period === 1 ? "" : "e"}`,
    historicalStand: String(profile.performance.stand || ""),
    historicalSource: String(profile.performance.source || "Fondsweb"),
    sourceUrl: String(profile.performance.source_url || `https://www.fondsweb.com/at/${profile.isin}`),
    historicalNote: "Wertentwicklung nach BVI-/Total-Return-Methode; Vergangenheitswerte sind keine Prognose."
  };
}

function readReturnFallbackCache() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RETURN_FALLBACK_CACHE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeReturnFallbackCache(cache) {
  try { localStorage.setItem(RETURN_FALLBACK_CACHE_KEY, JSON.stringify(cache)); } catch { /* optional cache */ }
}

function fallbackCacheKey(isin, periodYears) {
  return `${isin}:${periodYears}`;
}

function isoYearsAgo(years) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(date.getUTCFullYear() - years);
  return date.toISOString().slice(0, 10);
}

function preferredFallbackPeriod(years) {
  const term = Number(years);
  return STANDARD_RETURN_PERIODS.find((period) => period <= term) || 1;
}

async function fetchUnionPriceHistoricalProfile(profile, years) {
  const periodYears = preferredFallbackPeriod(years);
  const cache = readReturnFallbackCache();
  const key = fallbackCacheKey(profile.isin, periodYears);
  const cached = cache[key];
  const cachedAt = Date.parse(cached?.fetchedAt || "");
  if (cached && Number.isFinite(cachedAt) && Date.now() - cachedAt < RETURN_FALLBACK_CACHE_DAYS * 86_400_000) {
    return { ...profile, ...cached.profile };
  }

  const end = new Date().toISOString().slice(0, 10);
  const start = isoYearsAgo(periodYears);
  const url = new URL(`${DATA_PROXY}/union-prices`);
  url.searchParams.set("isin", profile.isin);
  url.searchParams.set("start", start);
  url.searchParams.set("end", end);
  const response = await fetch(url.toString(), { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Union-Kursdaten konnten nicht geladen werden.");

  const observations = [];
  if (payload.previous_observation) observations.push(payload.previous_observation);
  observations.push(...(Array.isArray(payload.observations) ? payload.observations : []));
  const valid = observations
    .map((item) => ({ date: String(item?.date || ""), price: Number(item?.redemption_price) }))
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.date) && Number.isFinite(item.price) && item.price > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (valid.length < 2) throw new Error("Zu wenige historische Union-Kurse verfügbar.");
  const first = valid[0];
  const last = valid.at(-1);
  const durationYears = (Date.parse(`${last.date}T00:00:00Z`) - Date.parse(`${first.date}T00:00:00Z`)) / (365.2425 * 86_400_000);
  if (!Number.isFinite(durationYears) || durationYears < 0.75) throw new Error("Historischer Kurszeitraum ist zu kurz.");
  const annualized = (Math.pow(last.price / first.price, 1 / durationYears) - 1) * 100;
  if (!Number.isFinite(annualized)) throw new Error("Kursbasierte Durchschnittsrendite konnte nicht berechnet werden.");

  const derived = {
    historicalReturnPercent: annualized,
    historicalPeriod: `ca. ${numberDe(durationYears, 1)} Jahre · kursbasiert`,
    historicalStand: last.date,
    historicalSource: "Union Investment",
    sourceUrl: "https://www.union-investment.de/fonds/fonds-finden",
    historicalNote: "Kursbasierte Näherung aus Rücknahmepreisen; Ausschüttungen sind nicht enthalten. Vergangenheitswerte sind keine Prognose."
  };
  cache[key] = { fetchedAt: new Date().toISOString(), profile: derived };
  writeReturnFallbackCache(cache);
  return { ...profile, ...derived };
}

async function resolveHistoricalProfile(profile, years) {
  const standardized = selectStandardizedPerformance(profile, years);
  if (standardized) return standardized;
  return fetchUnionPriceHistoricalProfile(profile, years);
}

function renderReturnSuggestion(profile = returnAssumption.profile) {
  const suggestionHost = document.querySelector("[data-return-suggestions]");
  const sourceHost = document.querySelector("[data-return-source]");
  sourceHost.classList.remove("is-loading");
  if (!profile || !Number.isFinite(profile.historicalReturnPercent)) {
    suggestionHost.hidden = true;
    suggestionHost.innerHTML = "";
    sourceHost.textContent = "Individuelle Renditeannahme.";
    return;
  }

  const values = suggestReturnScenarios(profile.historicalReturnPercent);
  suggestionHost.innerHTML = values.map((value, index) => {
    const historical = index === 2;
    return `<button type="button" class="ifc-return-chip${historical ? " ifc-return-chip--historical" : ""}" data-return-value="${value}" data-return-kind="${historical ? "historical" : "scenario"}">${numberDe(value, historical ? 2 : 0)} %${historical ? " · historisch" : ""}</button>`;
  }).join("");
  suggestionHost.hidden = false;

  if (returnAssumption.mode === "historical") {
    const source = profile.sourceUrl
      ? `<a href="${profile.sourceUrl}" target="_blank" rel="noopener">${profile.historicalSource}</a>`
      : profile.historicalSource;
    const stand = profile.historicalStand ? ` · Stand ${formatIsoDateDe(profile.historicalStand)}` : "";
    const note = profile.historicalNote ? `<br><span>${profile.historicalNote}</span>` : "<br><span>Vergangenheitswerte sind keine Prognose.</span>";
    sourceHost.innerHTML = `Historischer Vorschlag: <strong>${numberDe(profile.historicalReturnPercent, 2)} % p.a.</strong> (${profile.historicalPeriod}) · Quelle: ${source}${stand}${note}`;
  } else {
    sourceHost.textContent = "Individuelle Renditeannahme.";
  }
}

function renderReturnLoading(profile) {
  const suggestionHost = document.querySelector("[data-return-suggestions]");
  const sourceHost = document.querySelector("[data-return-source]");
  suggestionHost.hidden = true;
  suggestionHost.innerHTML = "";
  sourceHost.classList.add("is-loading");
  sourceHost.textContent = `${profile.name}: historische Rendite wird ermittelt …`;
}

async function applyFundProfile({ forceHistorical = true, profile = null, preferredField = "" } = {}) {
  const baseProfile = profile || matchFundProfile(preferredField);
  const requestId = ++historicalRequestSequence;
  if (!baseProfile) {
    returnAssumption = { mode: "manual", profile: null };
    renderReturnSuggestion(null);
    renderFundMatchStatus(null);
    return;
  }

  el("fundName").value = baseProfile.name;
  el("fundIsin").value = baseProfile.isin;
  if (Number.isFinite(baseProfile.issueLoadPercent)) {
    el("issueLoadPercent").value = String(baseProfile.issueLoadPercent);
  } else {
    el("issueLoadPercent").value = "";
  }
  updateEffectiveIssueLoad();
  updateOekbLink();
  renderFundMatchStatus(baseProfile);
  renderReturnLoading(baseProfile);

  try {
    const historicalProfile = await resolveHistoricalProfile(baseProfile, Number(el("years").value));
    if (requestId !== historicalRequestSequence) return;
    if (forceHistorical && Number.isFinite(historicalProfile.historicalReturnPercent)) {
      el("grossReturnPercent").value = String(Number(historicalProfile.historicalReturnPercent.toFixed(6)));
      returnAssumption = { mode: "historical", profile: historicalProfile };
    } else {
      const previousMode = returnAssumption.profile?.isin === historicalProfile.isin ? returnAssumption.mode : "manual";
      returnAssumption = { mode: previousMode, profile: historicalProfile };
    }
    renderReturnSuggestion(historicalProfile);
  } catch (error) {
    if (requestId !== historicalRequestSequence) return;
    returnAssumption = { mode: "manual", profile: baseProfile };
    const suggestionHost = document.querySelector("[data-return-suggestions]");
    const sourceHost = document.querySelector("[data-return-source]");
    suggestionHost.hidden = true;
    suggestionHost.innerHTML = "";
    sourceHost.classList.remove("is-loading");
    sourceHost.textContent = `${baseProfile.name}: keine historische Rendite automatisch verfügbar (${error instanceof Error ? error.message : String(error)}). Individuelle Renditeannahme.`;
  }
}

async function refreshHistoricalSuggestionForYears() {
  const currentBase = matchFundProfile() || returnAssumption.profile;
  if (!currentBase?.isin) return;
  const base = fundProfiles.find((item) => item.isin === currentBase.isin) || currentBase;
  const requestId = ++historicalRequestSequence;
  try {
    const historicalProfile = await resolveHistoricalProfile(base, Number(el("years").value));
    if (requestId !== historicalRequestSequence) return;
    const mode = returnAssumption.mode;
    returnAssumption = { mode, profile: historicalProfile };
    if (mode === "historical") el("grossReturnPercent").value = String(Number(historicalProfile.historicalReturnPercent.toFixed(6)));
    renderReturnSuggestion(historicalProfile);
  } catch {
    // Laufzeitänderungen dürfen eine zuvor manuell gewählte Annahme nicht blockieren.
  }
}

function loadDepotCostDefaults() {
  try {
    const raw = localStorage.getItem(DEPOT_COST_STORAGE_KEY) || localStorage.getItem(LEGACY_DEPOT_COST_STORAGE_KEY) || "null";
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      if (Number.isFinite(Number(parsed.percent))) el("depotFeePercent").value = String(parsed.percent);
      if (Number.isFinite(Number(parsed.annual))) el("depotFeeAnnual").value = numberDe(Number(parsed.annual), 2);
      el("issueLoadDiscountPercent").value = Number.isFinite(Number(parsed.discount)) ? String(parsed.discount) : "0";
      return;
    }
    el("issueLoadDiscountPercent").value = "0";
  } catch {
    el("issueLoadDiscountPercent").value = "0";
  }
}

function saveDepotCostDefaults() {
  try {
    const percent = Number(el("depotFeePercent").value);
    const annual = parseGermanNumber(el("depotFeeAnnual").value);
    const discount = Number(el("issueLoadDiscountPercent").value);
    if (![percent, annual, discount].every(Number.isFinite)) return;
    localStorage.setItem(DEPOT_COST_STORAGE_KEY, JSON.stringify({ percent, annual, discount }));
  } catch { /* localStorage kann im Browser deaktiviert sein */ }
}

function comparisonClass(own, other, { higherIsBetter = false } = {}) {
  if (!Number.isFinite(own) || !Number.isFinite(other) || Math.abs(own - other) < 0.005) return "is-neutral";
  const ownBetter = higherIsBetter ? own > other : own < other;
  return ownBetter ? "is-better" : "is-worse";
}

function advantageHtml(own, other, { higherIsBetter = false, compare = true } = {}) {
  if (!compare || !Number.isFinite(own) || !Number.isFinite(other) || Math.abs(own - other) < 0.005) return "";
  const ownBetter = higherIsBetter ? own > other : own < other;
  if (!ownBetter) return "";
  return `<span class="ifc-compare__advantage">Vorteil + ${money(Math.abs(own - other))}</span>`;
}

function comparisonValueHtml(value, other, { higherIsBetter = false, compare = true, detail = "" } = {}) {
  if (!Number.isFinite(value)) {
    return `<div class="ifc-compare__value is-neutral"><strong>–</strong>${detail ? `<small>${detail}</small>` : ""}</div>`;
  }
  const className = compare ? comparisonClass(value, other, { higherIsBetter }) : "is-neutral";
  return `<div class="ifc-compare__value ${className}"><strong>${money(value)}</strong>${detail ? `<small>${detail}</small>` : ""}${advantageHtml(value, other, { higherIsBetter, compare })}</div>`;
}

function comparisonRowHtml({ label, insurance, direct, higherIsBetter = false, compare = true, insuranceDetail = "", directDetail = "", summary = false, result = false }) {
  return `<div class="ifc-compare__row${summary ? " is-summary" : ""}${result ? " is-result" : ""}">
    <div class="ifc-compare__label">${label}</div>
    ${comparisonValueHtml(insurance, direct, { higherIsBetter, compare, detail: insuranceDetail })}
    ${comparisonValueHtml(direct, insurance, { higherIsBetter, compare, detail: directDetail })}
  </div>`;
}

function renderComparisonBreakdown(result) {
  const host = document.querySelector("[data-comparison-breakdown]");
  const exitInsuranceTax = result.insurance.additionalInsuranceTax + result.insurance.incomeTax;
  const groups = [
    { title: "Start", rows: [
      { label: "Kundenaufwand", insurance: result.inputs.amount, direct: result.inputs.amount, compare: false },
      { label: "Zu Beginn veranlagt", insurance: result.insurance.initialNetPremium, direct: result.direct.initialInvestment, higherIsBetter: true, insuranceDetail: "Nettoeinmalprämie nach VSt", directDetail: "nach Ausgabeaufschlag" }
    ]},
    { title: "Kosten", rows: [
      { label: "Einmalkosten", insurance: result.insurance.entryCostCharged, direct: result.direct.issueLoadCost, insuranceDetail: "Abschlusskosten", directDetail: "Ausgabeaufschlag" },
      { label: "Laufende Kosten", insurance: result.insurance.adminCosts, direct: result.direct.depotCosts, insuranceDetail: `Verwaltung: Netto-Prämie ${money(result.insurance.adminPremiumCosts)} · Vermögen ${money(result.insurance.adminAssetCosts)}`, directDetail: "Depotkosten" },
      { label: "Risikokosten", insurance: result.insurance.riskCosts, direct: NaN, compare: false, insuranceDetail: "Versicherung", directDetail: "keine entsprechende Position" },
      { label: "Kosten gesamt", insurance: result.insurance.totalCosts, direct: result.direct.totalCosts, summary: true }
    ]},
    { title: "Steuern", rows: [
      { label: "Während Start/Laufzeit", insurance: result.insurance.initialInsuranceTax, direct: result.direct.annualTaxes, compare: false, insuranceDetail: "Versicherungssteuer bei Einzahlung", directDetail: "unterjährige KESt (Modell)" },
      { label: "Bei Ausstieg/Verkauf", insurance: exitInsuranceTax, direct: result.direct.saleTax, insuranceDetail: "zusätzliche VSt + Differenz-ESt", directDetail: "KESt bei Verkauf" },
      { label: "Steuern gesamt", insurance: result.insurance.totalTaxes, direct: result.direct.totalTaxes, summary: true }
    ]},
    { title: "Ergebnis", rows: [
      { label: "Nettoendwert", insurance: result.insurance.endValue, direct: result.direct.endValue, higherIsBetter: true, result: true }
    ]}
  ];

  host.innerHTML = `<div class="ifc-compare__header"><span>Position</span><strong>Fondsversicherung</strong><strong>Fondsdepot</strong></div>` + groups.map((group) => `
    <section class="ifc-compare__section">
      <h3>${group.title}</h3>
      ${group.rows.map(comparisonRowHtml).join("")}
    </section>`).join("");
}

function renderChart(history, comparison) {
  const host = document.querySelector("[data-chart]");
  const points = Array.isArray(history) ? history : [];
  if (!points.length) { host.innerHTML = ""; return; }

  const width = 900;
  const height = 340;
  const pad = { left: 72, right: 24, top: 34, bottom: 46 };
  const values = points.flatMap((p) => [p.insuranceNetValue, p.directNetValue, 0]);
  const maxValue = Math.max(...values) || 1;
  const minValue = Math.min(...values, 0);
  const firstYear = points[0].year;
  const lastYear = points[points.length - 1].year;
  const x = (year) => pad.left + ((year - firstYear) / Math.max(1, lastYear - firstYear)) * (width - pad.left - pad.right);
  const y = (value) => pad.top + (maxValue - value) / Math.max(1, maxValue - minValue) * (height - pad.top - pad.bottom);
  const pathFor = (key) => points.map((p, index) => `${index ? "L" : "M"}${x(p.year).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");

  const grid = [];
  for (let i = 0; i <= 4; i += 1) {
    const value = minValue + ((maxValue - minValue) * i / 4);
    const yy = y(value);
    grid.push(`<line x1="${pad.left}" y1="${yy}" x2="${width - pad.right}" y2="${yy}" class="ifc-chart-grid"/>`);
    grid.push(`<text x="${pad.left - 10}" y="${yy + 4}" text-anchor="end" class="ifc-chart-label">${Math.round(value).toLocaleString("de-AT")} €</text>`);
  }

  const yearLabels = points.filter((_, index) => index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 6) === 0)
    .map((p) => `<text x="${x(p.year)}" y="${height - 14}" text-anchor="middle" class="ifc-chart-label">${p.year}</text>`).join("");

  let breakEvenMarkup = "";
  const breakEven = Number(comparison?.breakEvenYearApprox);
  if (Number.isFinite(breakEven) && breakEven >= firstYear && breakEven <= lastYear) {
    const bx = x(breakEven);
    let crossingValue = points[0].insuranceNetValue;
    const upperIndex = points.findIndex((point) => point.year >= breakEven);
    if (upperIndex > 0) {
      const lower = points[upperIndex - 1];
      const upper = points[upperIndex];
      const span = Math.max(1e-9, upper.year - lower.year);
      const fraction = (breakEven - lower.year) / span;
      const insuranceAtCrossing = lower.insuranceNetValue + (upper.insuranceNetValue - lower.insuranceNetValue) * fraction;
      const directAtCrossing = lower.directNetValue + (upper.directNetValue - lower.directNetValue) * fraction;
      crossingValue = (insuranceAtCrossing + directAtCrossing) / 2;
    } else if (upperIndex === 0) {
      crossingValue = (points[0].insuranceNetValue + points[0].directNetValue) / 2;
    }
    const by = y(crossingValue);
    breakEvenMarkup = `
      <line x1="${bx}" y1="${by}" x2="${bx}" y2="${height - pad.bottom}" class="ifc-break-even-line"/>
      <circle cx="${bx}" cy="${by}" r="4.5" class="ifc-break-even-point"/>
      <text x="${Math.min(width - 115, bx + 7)}" y="${Math.max(pad.top + 12, by - 9)}" class="ifc-break-even-label">Break-even ~ Jahr ${numberDe(breakEven, 1)}</text>`;
  }

  host.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Entwicklung der Nettoauszahlungswerte">
      <style>
        .ifc-chart-grid{stroke:var(--border);stroke-width:1}.ifc-chart-label{fill:var(--text-muted);font:12px system-ui,sans-serif}.ifc-chart-line-a{fill:none;stroke:var(--accent);stroke-width:3}.ifc-chart-line-b{fill:none;stroke:color-mix(in srgb,var(--accent) 45%,#9b7e25);stroke-width:3}.ifc-break-even-line{stroke:var(--text-muted);stroke-width:1.5;stroke-dasharray:6 5}.ifc-break-even-point{fill:var(--surface);stroke:var(--accent);stroke-width:3}.ifc-break-even-label{fill:var(--text);font:700 12px system-ui,sans-serif}
      </style>
      ${grid.join("")}
      <path d="${pathFor("insuranceNetValue")}" class="ifc-chart-line-a"/>
      <path d="${pathFor("directNetValue")}" class="ifc-chart-line-b"/>
      ${breakEvenMarkup}
      ${yearLabels}
      <text x="${(pad.left + width - pad.right) / 2}" y="${height - 1}" text-anchor="middle" class="ifc-chart-label">Jahr</text>
    </svg>`;
}

function renderResult(result) {
  document.querySelector("[data-insurance-end]").textContent = money(result.insurance.endValue);
  document.querySelector("[data-insurance-return]").textContent = `Netto-Effektivrendite ${pct(result.insurance.effectiveReturn * 100)} p.a.`;
  document.querySelector("[data-direct-end]").textContent = money(result.direct.endValue);
  document.querySelector("[data-direct-return]").textContent = `Netto-Effektivrendite ${pct(result.direct.effectiveReturn * 100)} p.a.`;

  const diff = result.comparison.difference;
  const winnerText = result.comparison.winner === "insurance" ? "Vorteil Fondsversicherung" : result.comparison.winner === "direct" ? "Vorteil Fondsdepot" : "Gleichstand";
  document.querySelector("[data-difference-label]").textContent = winnerText;
  document.querySelector("[data-difference]").textContent = result.comparison.winner === "equal" ? money(0) : `${diff >= 0 ? "+" : ""}${money(diff)}`;
  document.querySelector("[data-break-even]").textContent = result.comparison.breakEvenYear
    ? `Fondsversicherung erstmals ab Jahr ${result.comparison.breakEvenYear} vorne${Number.isFinite(result.comparison.breakEvenYearApprox) ? ` · Schnittpunkt ca. Jahr ${numberDe(result.comparison.breakEvenYearApprox, 1)}` : ""}`
    : "Kein Break-even zugunsten der Fondsversicherung innerhalb der Laufzeit";

  renderComparisonBreakdown(result);

  renderChart(result.history, result.comparison);
  resultsHost.hidden = false;
  resultsHost.scrollIntoView({ behavior: "smooth", block: "start" });
}

function calculate() {
  setError();
  try {
    const inputs = collectInputs();
    const result = simulateInsuranceFundComparison(inputs);
    saveDepotCostDefaults();
    saveInsuranceCostDefaults();
    renderResult(result);
    return { inputs, result };
  } catch (error) {
    resultsHost.hidden = true;
    setError(error instanceof Error ? error.message : String(error));
    return null;
  }
}

async function saveJsonFile(data, suggestedName) {
  const text = JSON.stringify(data, null, 2);
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName, types: [{ description: "JSON-Datei", accept: { "application/json": [".json"] } }] });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function restoreReturnMode(inputs) {
  const base = matchFundProfile();
  if (!base) {
    returnAssumption = { mode: "manual", profile: null };
    renderReturnSuggestion(null);
    renderFundMatchStatus(null);
    return;
  }
  const mode = ["historical", "scenario", "manual"].includes(inputs?.returnAssumptionMode) ? inputs.returnAssumptionMode : "manual";
  let profile = selectStandardizedPerformance(base, Number(inputs?.years));
  const importedHistorical = Number(inputs?.historicalReturnPercent);
  if (!profile && Number.isFinite(importedHistorical)) {
    profile = {
      ...base,
      historicalReturnPercent: importedHistorical,
      historicalPeriod: "importierter historischer Vorschlag",
      historicalStand: String(inputs?.historicalReturnStand || ""),
      historicalSource: "Import",
      sourceUrl: "",
      historicalNote: "Vergangenheitswerte sind keine Prognose."
    };
  }
  profile ||= base;
  returnAssumption = { mode, profile };
  renderFundMatchStatus(base);
  renderReturnSuggestion(profile);
}

function applyInputs(inputs) {
  const setters = {
    amount: (v) => { el("amount").value = numberDe(Number(v), 2); },
    insuranceMinimumAmount: (v) => { el("insuranceMinimumAmount").value = numberDe(Number(v), 2); },
    insuranceRiskAnnual: (v) => { el("insuranceRiskAnnual").value = numberDe(Number(v), 2); },
    depotFeeAnnual: (v) => { el("depotFeeAnnual").value = numberDe(Number(v), 2); },
    age50Plus: (v) => { el("age50Plus").checked = Boolean(v); }
  };
  Object.entries(inputs || {}).forEach(([key, value]) => {
    if (setters[key]) return setters[key](value);
    const node = el(key === "product" ? "insuranceProduct" : key);
    if (node && value !== undefined && value !== null) node.value = String(value);
  });
  activeInsuranceProduct = el("insuranceProduct").value;
  updateProductPreset({ preserveManual: true });
  updateDirectTaxFields();
  updateEffectiveIssueLoad();
  updateShortTermWarning();
  updateOekbLink();
  restoreReturnMode(inputs);
}

form.addEventListener("submit", (event) => { event.preventDefault(); calculate(); });
el("insuranceProduct").addEventListener("change", () => {
  saveInsuranceCostDefaults(activeInsuranceProduct);
  activeInsuranceProduct = el("insuranceProduct").value;
  updateProductPreset();
});
el("directTaxMode").addEventListener("change", updateDirectTaxFields);
el("age50Plus").addEventListener("change", updateShortTermWarning);
el("years").addEventListener("input", () => {
  updateShortTermWarning();
  refreshHistoricalSuggestionForYears();
});
el("insuranceTaxPercent").addEventListener("input", updateShortTermWarning);
el("issueLoadPercent").addEventListener("input", updateEffectiveIssueLoad);
el("issueLoadDiscountPercent").addEventListener("input", updateEffectiveIssueLoad);
el("fundIsin").addEventListener("input", updateOekbLink);

[el("amount"), el("insuranceMinimumAmount"), el("insuranceRiskAnnual"), el("depotFeeAnnual")].forEach((input) => {
  input.addEventListener("blur", () => formatAmountInput(input));
});

[el("depotFeePercent"), el("depotFeeAnnual"), el("issueLoadDiscountPercent")].forEach((input) => {
  input.addEventListener("change", saveDepotCostDefaults);
  input.addEventListener("blur", saveDepotCostDefaults);
});

[el("insuranceEntryCostPercent"), el("insuranceEntryCostYears"), el("insuranceAdminPremiumPercent"), el("insuranceAdminAssetPercent"), el("insuranceRiskAnnual")].forEach((input) => {
  input.addEventListener("change", () => saveInsuranceCostDefaults());
  input.addEventListener("blur", () => saveInsuranceCostDefaults());
});

async function handleFundReferenceInput(changedField) {
  const matched = matchFundProfile(changedField);
  if (matched) {
    await applyFundProfile({ forceHistorical: true, profile: matched, preferredField: changedField });
    return;
  }

  const profile = returnAssumption.profile;
  if (profile) {
    if (changedField === "name") {
      const name = normalizeFundName(el("fundName").value);
      if (!profile.searchNames?.includes(name) && el("fundIsin").value.trim().toUpperCase() === profile.isin) el("fundIsin").value = "";
    } else {
      const isin = el("fundIsin").value.trim().toUpperCase();
      if (isin && isin !== profile.isin && normalizeFundName(el("fundName").value) === normalizeFundName(profile.name)) el("fundName").value = "";
    }
  }
  ++historicalRequestSequence;
  returnAssumption = { mode: "manual", profile: null };
  renderReturnSuggestion(null);
  renderFundMatchStatus(null);
  updateOekbLink();
}

el("fundName").addEventListener("input", () => { handleFundReferenceInput("name"); });
el("fundIsin").addEventListener("input", () => { handleFundReferenceInput("isin"); });

[el("fundName"), el("fundIsin")].forEach((input) => {
  input.addEventListener("change", () => { applyFundProfile({ forceHistorical: true, preferredField: input.id === "fundName" ? "name" : "isin" }); });
  input.addEventListener("blur", () => { applyFundProfile({ forceHistorical: true, preferredField: input.id === "fundName" ? "name" : "isin" }); });
});

el("grossReturnPercent").addEventListener("input", () => {
  returnAssumption = { mode: "manual", profile: returnAssumption.profile || matchFundProfile() };
  renderReturnSuggestion(returnAssumption.profile);
});

document.querySelector("[data-return-suggestions]").addEventListener("click", (event) => {
  const button = event.target.closest("[data-return-value]");
  if (!button) return;
  const value = Number(button.dataset.returnValue);
  if (!Number.isFinite(value)) return;
  el("grossReturnPercent").value = String(value);
  returnAssumption = { mode: button.dataset.returnKind === "historical" ? "historical" : "scenario", profile: returnAssumption.profile || matchFundProfile() };
  renderReturnSuggestion(returnAssumption.profile);
  resultsHost.hidden = true;
});

form.addEventListener("input", (event) => {
  if (!event.target.closest("[data-export], [data-import], [data-reset]")) {
    resultsHost.hidden = true;
    setError();
  }
});

form.addEventListener("change", (event) => {
  if (!event.target.closest("[data-export], [data-import], [data-reset]")) {
    resultsHost.hidden = true;
    setError();
  }
});

form.querySelector("[data-export]").addEventListener("click", async () => {
  setError();
  try {
    const inputs = collectInputs();
    const payload = createInsuranceFundCompareData({ inputs, toolboxVersion: TOOLBOX_VERSION, exportedAt: new Date().toISOString() });
    await saveJsonFile(payload, `fondsversicherung_vs_fondsdepot_${new Date().toISOString().slice(0, 10)}.json`);
  } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
});

form.querySelector("[data-import]").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", async () => {
  const file = importFile.files?.[0];
  importFile.value = "";
  if (!file) return;
  setError();
  try {
    const payload = JSON.parse(await file.text());
    const normalized = normalizeInsuranceFundCompareData(payload);
    applyInputs(normalized.inputs);
    calculate();
  } catch (error) { setError(error instanceof Error ? error.message : String(error)); }
});

form.querySelector("[data-reset]").addEventListener("click", () => {
  form.reset();
  el("amount").value = "100.000,00";
  el("insuranceRiskAnnual").value = "0,00";
  loadDepotCostDefaults();
  activeInsuranceProduct = el("insuranceProduct").value;
  ++historicalRequestSequence;
  returnAssumption = { mode: "manual", profile: null };
  renderReturnSuggestion(null);
  renderFundMatchStatus(null);
  updateProductPreset();
  updateDirectTaxFields();
  updateEffectiveIssueLoad();
  updateOekbLink();
  resultsHost.hidden = true;
  setError();
});

async function initInsuranceFundCompare() {
  loadDepotCostDefaults();
  activeInsuranceProduct = el("insuranceProduct").value;
  updateProductPreset();
  updateDirectTaxFields();
  updateEffectiveIssueLoad();
  updateOekbLink();
  await loadFundPalette();
  if (el("fundName").value.trim() || el("fundIsin").value.trim()) {
    await applyFundProfile({ forceHistorical: true });
  }
}

initInsuranceFundCompare();
