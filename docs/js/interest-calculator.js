import { calculateInterest } from "./interest-calculator-utils.js?v=0.8.5";

const METHOD_STORAGE_KEY = "toolbox:interest-calculator:method:v1";
const OVERDRAFT_RATE_STORAGE_KEY = "toolbox:interest-calculator:overdraft-rate:v1";
const DEFAULT_PERIOD_MODE = "DATES";
const DEFAULT_METHOD = "ACT_360";
const ALLOWED_METHODS = new Set(["ACT_360", "ACT_365", "30_360"]);
const MONTH_NAMES = [
  "Jänner", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const form = document.querySelector("[data-interest-form]");
const errorNode = document.querySelector("[data-interest-error]");
const resultsNode = document.querySelector("[data-interest-results]");
const methodSelect = document.querySelector("#calculationMethod");
const periodModeSelect = document.querySelector("#periodMode");
const debitRateInput = document.querySelector("#debitRatePercent");
const overdraftRateInput = document.querySelector("#overdraftRatePercent");
const limitInput = document.querySelector("#limitAmount");
const amountInput = document.querySelector("#amount");
const startDateInput = document.querySelector("#startDate");
const endDateInput = document.querySelector("#endDate");
const dayCountInput = document.querySelector("#dayCount");

const overdraftField = document.querySelector("[data-overdraft-field]");
const periodModeField = document.querySelector("[data-period-mode-field]");
const dateFields = document.querySelector("[data-date-fields]");
const daysField = document.querySelector("[data-days-field]");
const methodField = document.querySelector("[data-method-field]");
const submitButton = document.querySelector("[data-submit-button]");
const resetButton = document.querySelector("[data-reset-button]");
const periodModeEditButton = document.querySelector("[data-period-mode-edit]");

const dateRangeTrigger = document.querySelector("[data-date-range-trigger]");
const dateRangeValue = document.querySelector("[data-date-range-value]");
const dateRangePopover = document.querySelector("[data-date-range-popover]");
const calendarMonths = document.querySelector("[data-calendar-months]");
const calendarStatus = document.querySelector("[data-calendar-status]");
const calendarPrev = document.querySelector("[data-calendar-prev]");
const calendarNext = document.querySelector("[data-calendar-next]");

const amountInputs = [limitInput, amountInput];

const output = {
  debitInterest: document.querySelector("[data-debit-interest]"),
  overdraftInterest: document.querySelector("[data-overdraft-interest]"),
  totalInterest: document.querySelector("[data-total-interest]"),
  period: document.querySelector("[data-period-meta]")
};

const currency = new Intl.NumberFormat("de-AT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const calendarState = {
  visibleYear: new Date().getFullYear(),
  visibleMonth: new Date().getMonth(),
  selectingEnd: false
};

function parseGermanNumber(value) {
  let normalized = String(value ?? "").trim().replace(/[\s']/g, "");
  if (!normalized) return NaN;
  const comma = normalized.lastIndexOf(",");
  const dot = normalized.lastIndexOf(".");

  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (comma >= 0) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }
  return Number(normalized);
}

function optionalAmount(value) {
  return String(value ?? "").trim() === "" ? 0 : parseGermanNumber(value);
}

function formatAmountValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";

  const sign = number < 0 ? "-" : "";
  const [integerPart, fractionPart] = Math.abs(number).toFixed(2).split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${grouped},${fractionPart}`;
}

function formatAmountInput(input) {
  if (!input || !input.value.trim()) return;
  const value = parseGermanNumber(input.value);
  if (Number.isFinite(value)) input.value = formatAmountValue(value);
}

function clearResults() {
  if (errorNode) {
    errorNode.textContent = "";
    errorNode.hidden = true;
  }
  if (resultsNode) resultsNode.hidden = true;
  Object.values(output).forEach((node) => {
    if (node) node.textContent = "";
  });
}

function loadStoredMethod() {
  try {
    const stored = localStorage.getItem(METHOD_STORAGE_KEY);
    return ALLOWED_METHODS.has(stored) ? stored : DEFAULT_METHOD;
  } catch {
    return DEFAULT_METHOD;
  }
}

function saveMethod(value) {
  if (!ALLOWED_METHODS.has(value)) return;
  try {
    localStorage.setItem(METHOD_STORAGE_KEY, value);
  } catch {
    // Lokale Speicherung ist Komfortfunktion; Berechnung bleibt nutzbar.
  }
}

function loadStoredOverdraftRate() {
  try {
    const stored = localStorage.getItem(OVERDRAFT_RATE_STORAGE_KEY);
    const value = parseGermanNumber(stored);
    return Number.isFinite(value) && value >= 0 ? stored : "";
  } catch {
    return "";
  }
}

function saveOverdraftRate(value) {
  const parsed = parseGermanNumber(value);
  if (!Number.isFinite(parsed) || parsed < 0) return;
  try {
    localStorage.setItem(OVERDRAFT_RATE_STORAGE_KEY, String(value).trim());
  } catch {
    // Lokale Speicherung ist Komfortfunktion; Berechnung bleibt nutzbar.
  }
}

function setPeriodModeLocked(locked) {
  if (!periodModeSelect) return;
  periodModeSelect.disabled = locked;
  periodModeSelect.setAttribute("aria-readonly", locked ? "true" : "false");
  if (periodModeEditButton) {
    periodModeEditButton.setAttribute("aria-expanded", locked ? "false" : "true");
  }
}

function resetCalculator() {
  closeCalendar();
  form?.reset();
  if (periodModeSelect) periodModeSelect.value = DEFAULT_PERIOD_MODE;
setPeriodModeLocked(true);
  setPeriodModeLocked(true);
  if (methodSelect) methodSelect.value = loadStoredMethod();
  if (overdraftRateInput) overdraftRateInput.value = loadStoredOverdraftRate();
  if (startDateInput) startDateInput.value = "";
  if (endDateInput) endDateInput.value = "";
  if (dayCountInput) dayCountInput.value = "";
  calendarState.selectingEnd = false;
  clearResults();
  updateDateRangeLabel();
  updateProgressiveFields();
  debitRateInput?.focus();
}

function methodLabel(value) {
  if (value === "ACT_365") return "act/365";
  if (value === "30_360") return "30/360";
  return "act/360";
}

function hasValidBaseInputs() {
  const debitRate = parseGermanNumber(debitRateInput?.value);
  const amount = parseGermanNumber(amountInput?.value);
  const limit = optionalAmount(limitInput?.value);
  return Number.isFinite(debitRate) && debitRate >= 0 && Number.isFinite(amount) && amount >= 0 && Number.isFinite(limit) && limit >= 0;
}

function needsOverdraftRate() {
  const amount = parseGermanNumber(amountInput?.value);
  const limit = optionalAmount(limitInput?.value);
  return Number.isFinite(amount) && Number.isFinite(limit) && amount > limit;
}

function overdraftInputReady() {
  if (!needsOverdraftRate()) return true;
  const rate = parseGermanNumber(overdraftRateInput?.value);
  return Number.isFinite(rate) && rate >= 0;
}

function periodInputReady() {
  if (periodModeSelect?.value === "DAYS") {
    const days = Number(dayCountInput?.value);
    return Number.isInteger(days) && days >= 0;
  }
  return Boolean(startDateInput?.value && endDateInput?.value);
}

function updateProgressiveFields() {
  const baseReady = hasValidBaseInputs();
  const overdraftNeeded = baseReady && needsOverdraftRate();
  if (overdraftField) overdraftField.hidden = !overdraftNeeded;

  const ratesReady = baseReady && overdraftInputReady();
  if (periodModeField) periodModeField.hidden = !ratesReady;

  const showPeriodInputs = ratesReady;
  const useDays = periodModeSelect?.value === "DAYS";
  if (dateFields) dateFields.hidden = !showPeriodInputs || useDays;
  if (daysField) daysField.hidden = !showPeriodInputs || !useDays;
  if ((!showPeriodInputs || useDays) && dateRangePopover && !dateRangePopover.hidden) closeCalendar();

  const periodReady = ratesReady && periodInputReady();
  if (methodField) methodField.hidden = !periodReady;
  if (submitButton) submitButton.hidden = !periodReady;
}

function render(result) {
  output.debitInterest.textContent = currency.format(result.debitInterest);
  output.overdraftInterest.textContent = currency.format(result.overdraftInterest);
  output.totalInterest.textContent = currency.format(result.totalInterest);
  output.period.textContent = `${result.days} Zinstag${result.days === 1 ? "" : "e"} · ${methodLabel(result.method)}`;
  errorNode.hidden = true;
  resultsNode.hidden = false;
}

function showError(message) {
  errorNode.textContent = message;
  errorNode.hidden = false;
  resultsNode.hidden = true;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function isoDate(year, monthIndex, day) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function parseIsoParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

function formatIsoDate(value) {
  const parts = parseIsoParts(value);
  if (!parts) return "";
  return `${pad2(parts.day)}.${pad2(parts.month + 1)}.${parts.year}`;
}

function updateDateRangeLabel() {
  const start = startDateInput?.value || "";
  const end = endDateInput?.value || "";
  if (!dateRangeValue) return;
  if (start && end) {
    dateRangeValue.textContent = `${formatIsoDate(start)} – ${formatIsoDate(end)}`;
  } else if (start) {
    dateRangeValue.textContent = `${formatIsoDate(start)} – Enddatum wählen`;
  } else {
    dateRangeValue.textContent = "Zeitraum auswählen";
  }
}

function monthOffset(year, month, delta) {
  const date = new Date(Date.UTC(year, month + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

function visibleMonthCount() {
  return window.matchMedia("(max-width: 700px)").matches ? 1 : 2;
}

function firstWeekdayMondayBased(year, month) {
  const day = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return (day + 6) % 7;
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function renderCalendarMonth(year, month) {
  const section = document.createElement("section");
  section.className = "date-range-month";

  const heading = document.createElement("h3");
  heading.textContent = `${MONTH_NAMES[month]} ${year}`;
  section.appendChild(heading);

  const weekdays = document.createElement("div");
  weekdays.className = "date-range-weekdays";
  WEEKDAYS.forEach((weekday) => {
    const span = document.createElement("span");
    span.textContent = weekday;
    weekdays.appendChild(span);
  });
  section.appendChild(weekdays);

  const grid = document.createElement("div");
  grid.className = "date-range-grid";
  const leading = firstWeekdayMondayBased(year, month);
  for (let i = 0; i < leading; i += 1) {
    const filler = document.createElement("span");
    filler.className = "date-range-day date-range-day--empty";
    grid.appendChild(filler);
  }

  const start = startDateInput?.value || "";
  const end = endDateInput?.value || "";
  const totalDays = daysInMonth(year, month);

  for (let day = 1; day <= totalDays; day += 1) {
    const value = isoDate(year, month, day);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "date-range-day";
    button.textContent = String(day);
    button.dataset.date = value;
    button.setAttribute("aria-label", formatIsoDate(value));

    if (value === start) button.classList.add("date-range-day--start");
    if (value === end) button.classList.add("date-range-day--end");
    if (start && end && value > start && value < end) button.classList.add("date-range-day--inside");

    grid.appendChild(button);
  }

  section.appendChild(grid);
  return section;
}

function renderCalendar() {
  if (!calendarMonths) return;
  calendarMonths.replaceChildren();
  const count = visibleMonthCount();
  for (let index = 0; index < count; index += 1) {
    const shown = monthOffset(calendarState.visibleYear, calendarState.visibleMonth, index);
    calendarMonths.appendChild(renderCalendarMonth(shown.year, shown.month));
  }
  if (calendarStatus) {
    calendarStatus.textContent = calendarState.selectingEnd ? "Enddatum auswählen" : "Beginndatum auswählen";
  }
}

function setCalendarVisibleMonthFromSelection() {
  const selected = parseIsoParts(startDateInput?.value);
  const now = new Date();
  calendarState.visibleYear = selected?.year ?? now.getFullYear();
  calendarState.visibleMonth = selected?.month ?? now.getMonth();
}

function openCalendar() {
  if (!dateRangePopover || !dateRangeTrigger) return;
  setCalendarVisibleMonthFromSelection();
  calendarState.selectingEnd = Boolean(startDateInput?.value && !endDateInput?.value);
  renderCalendar();
  dateRangePopover.hidden = false;
  dateRangeTrigger.setAttribute("aria-expanded", "true");
}

function closeCalendar() {
  if (!dateRangePopover || !dateRangeTrigger) return;
  dateRangePopover.hidden = true;
  dateRangeTrigger.setAttribute("aria-expanded", "false");
}

function resetRangeToStart(value) {
  startDateInput.value = value;
  endDateInput.value = "";
  calendarState.selectingEnd = true;
  clearResults();
  updateDateRangeLabel();
  updateProgressiveFields();
  renderCalendar();
}

function finishRange(value) {
  endDateInput.value = value;
  calendarState.selectingEnd = false;
  clearResults();
  updateDateRangeLabel();
  updateProgressiveFields();
  renderCalendar();
  closeCalendar();
}

function chooseCalendarDate(value) {
  if (!startDateInput || !endDateInput) return;
  const start = startDateInput.value;
  const end = endDateInput.value;

  if (!calendarState.selectingEnd || !start || end) {
    resetRangeToStart(value);
    return;
  }

  if (value < start) {
    resetRangeToStart(value);
    return;
  }

  finishRange(value);
}

if (methodSelect) methodSelect.value = loadStoredMethod();
if (periodModeSelect) periodModeSelect.value = DEFAULT_PERIOD_MODE;
if (overdraftRateInput) overdraftRateInput.value = loadStoredOverdraftRate();
updateDateRangeLabel();
updateProgressiveFields();

form?.addEventListener("input", () => {
  clearResults();
  updateProgressiveFields();
});

form?.addEventListener("change", (event) => {
  clearResults();
  if (event.target === methodSelect) saveMethod(methodSelect.value);
  if (event.target === overdraftRateInput) saveOverdraftRate(overdraftRateInput.value);
  if (event.target === periodModeSelect) {
    if (periodModeSelect.value === "DATES") {
      if (dayCountInput) dayCountInput.value = "";
    } else {
      if (startDateInput) startDateInput.value = "";
      if (endDateInput) endDateInput.value = "";
      calendarState.selectingEnd = false;
      closeCalendar();
      updateDateRangeLabel();
    }
    setPeriodModeLocked(true);
  }
  updateProgressiveFields();
});

periodModeEditButton?.addEventListener("click", () => {
  setPeriodModeLocked(false);
  periodModeSelect?.focus();
});

periodModeSelect?.addEventListener("blur", () => {
  setPeriodModeLocked(true);
});

resetButton?.addEventListener("click", resetCalculator);

amountInputs.forEach((input) => {
  input?.addEventListener("blur", () => {
    formatAmountInput(input);
    updateProgressiveFields();
  });
});

dateRangeTrigger?.addEventListener("click", () => {
  if (dateRangePopover?.hidden) openCalendar();
  else closeCalendar();
});

calendarPrev?.addEventListener("click", () => {
  const previous = monthOffset(calendarState.visibleYear, calendarState.visibleMonth, -1);
  calendarState.visibleYear = previous.year;
  calendarState.visibleMonth = previous.month;
  renderCalendar();
});

calendarNext?.addEventListener("click", () => {
  const next = monthOffset(calendarState.visibleYear, calendarState.visibleMonth, 1);
  calendarState.visibleYear = next.year;
  calendarState.visibleMonth = next.month;
  renderCalendar();
});

calendarMonths?.addEventListener("click", (event) => {
  const target = event.target.closest("button[data-date]");
  if (!target) return;

  // Der Kalender wird nach dem ersten Datumsklick neu gerendert. Ohne
  // stopPropagation() erreicht derselbe Klick danach noch den globalen
  // Outside-Click-Handler; das alte Tages-Element ist dann bereits aus dem DOM
  // entfernt und würde fälschlich als Klick außerhalb erkannt.
  event.stopPropagation();
  chooseCalendarDate(target.dataset.date);
});

document.addEventListener("click", (event) => {
  if (!dateRangePopover || dateRangePopover.hidden) return;
  if (dateFields?.contains(event.target)) return;
  closeCalendar();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && dateRangePopover && !dateRangePopover.hidden) {
    closeCalendar();
    dateRangeTrigger?.focus();
  }
});

window.addEventListener("resize", () => {
  if (dateRangePopover && !dateRangePopover.hidden) renderCalendar();
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  clearResults();
  amountInputs.forEach(formatAmountInput);

  const data = new FormData(form);
  const useDays = periodModeSelect?.value === "DAYS";
  const limit = optionalAmount(data.get("limitAmount"));
  const amount = parseGermanNumber(data.get("amount"));
  const overdraftNeeded = Number.isFinite(amount) && Number.isFinite(limit) && amount > limit;

  try {
    const result = calculateInterest({
      debitRatePercent: parseGermanNumber(data.get("debitRatePercent")),
      overdraftRatePercent: overdraftNeeded ? parseGermanNumber(data.get("overdraftRatePercent")) : 0,
      limitAmount: limit,
      amount,
      startDate: useDays ? "" : String(data.get("startDate") || ""),
      endDate: useDays ? "" : String(data.get("endDate") || ""),
      dayCount: useDays ? String(data.get("dayCount") ?? "") : null,
      calculationMethod: String(data.get("calculationMethod") || DEFAULT_METHOD)
    });
    saveMethod(result.method);
    if (overdraftNeeded) saveOverdraftRate(overdraftRateInput?.value);
    render(result);
  } catch (error) {
    showError(error?.message || "Berechnung nicht möglich.");
  }
});
