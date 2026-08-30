import {
  addPeriod,
  calendarDifference,
  differenceInDays,
  formatDateDe,
  fullMonthsBetween,
  parseIsoDate
} from "./date-utils.js";

const integerFormatter = new Intl.NumberFormat("de-AT", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("de-AT", { maximumFractionDigits: 2 });

function todayIsoLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setMessage(host, message, type = "error") {
  host.textContent = message;
  host.className = `form-message form-message--${type}`;
  host.hidden = !message;
}

function plural(value, singular, pluralForm) {
  return `${integerFormatter.format(value)} ${value === 1 ? singular : pluralForm}`;
}

function calculateTargetDate(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const message = form.querySelector("[data-target-message]");
  const result = document.querySelector("[data-target-result]");
  const dateValue = form.elements.startDate.value;
  const amountValue = form.elements.amount.value.trim();
  const unit = form.elements.unit.value;

  setMessage(message, "");

  const start = parseIsoDate(dateValue);
  if (!start) {
    setMessage(message, "Bitte ein gültiges Ausgangsdatum eingeben.");
    result.hidden = true;
    return;
  }

  const amount = Number(amountValue);
  if (!Number.isInteger(amount)) {
    setMessage(message, "Bitte eine ganze Anzahl eingeben. Negative Werte sind zulässig.");
    result.hidden = true;
    return;
  }

  try {
    const target = addPeriod(start, amount, unit);
    const unitLabels = {
      days: ["Tag", "Tage"],
      weeks: ["Woche", "Wochen"],
      months: ["Monat", "Monate"]
    };
    const [singular, pluralForm] = unitLabels[unit];

    result.querySelector("[data-target-date]").textContent = formatDateDe(target);
    result.querySelector("[data-target-summary]").textContent = `${formatDateDe(start)} ${amount >= 0 ? "+" : "−"} ${plural(Math.abs(amount), singular, pluralForm)}`;
    result.hidden = false;
  } catch (error) {
    setMessage(message, error.message);
    result.hidden = true;
  }
}

function calculateDifference(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const message = form.querySelector("[data-difference-message]");
  const result = document.querySelector("[data-difference-result]");
  const start = parseIsoDate(form.elements.diffStartDate.value);
  const end = parseIsoDate(form.elements.endDate.value);

  setMessage(message, "");

  if (!start || !end) {
    setMessage(message, "Bitte zwei gültige Daten eingeben.");
    result.hidden = true;
    return;
  }

  try {
    const days = differenceInDays(start, end);
    if (days < 0) {
      throw new Error("Das Enddatum darf nicht vor dem Ausgangsdatum liegen.");
    }

    const hours = days * 24;
    const fullWeeks = Math.floor(days / 7);
    const remainingDays = days % 7;
    const months = fullMonthsBetween(start, end);
    const calendar = calendarDifference(start, end);

    result.querySelector("[data-diff-calendar]").textContent = [
      plural(calendar.years, "Jahr", "Jahre"),
      plural(calendar.months, "Monat", "Monate"),
      plural(calendar.days, "Tag", "Tage")
    ].join(", ");

    result.querySelector("[data-diff-days]").textContent = integerFormatter.format(days);
    result.querySelector("[data-diff-hours]").textContent = integerFormatter.format(hours);
    result.querySelector("[data-diff-weeks]").textContent = `${integerFormatter.format(fullWeeks)} + ${plural(remainingDays, "Tag", "Tage")}`;
    result.querySelector("[data-diff-weeks-decimal]").textContent = decimalFormatter.format(days / 7);
    result.querySelector("[data-diff-months]").textContent = integerFormatter.format(months);
    result.hidden = false;
  } catch (error) {
    setMessage(message, error.message);
    result.hidden = true;
  }
}

function syncDateFields(source, target) {
  target.value = source.value;
}

function initDateCalculator() {
  const targetForm = document.querySelector("[data-target-form]");
  const differenceForm = document.querySelector("[data-difference-form]");

  if (!targetForm || !differenceForm) return;

  const targetStartDate = targetForm.elements.startDate;
  const differenceStartDate = differenceForm.elements.diffStartDate;
  const today = todayIsoLocal();
  differenceForm.elements.endDate.value = today;

  const syncTargetToDifference = () => syncDateFields(targetStartDate, differenceStartDate);
  const syncDifferenceToTarget = () => syncDateFields(differenceStartDate, targetStartDate);

  targetStartDate.addEventListener("input", syncTargetToDifference);
  targetStartDate.addEventListener("change", syncTargetToDifference);
  differenceStartDate.addEventListener("input", syncDifferenceToTarget);
  differenceStartDate.addEventListener("change", syncDifferenceToTarget);

  targetForm.addEventListener("submit", calculateTargetDate);
  differenceForm.addEventListener("submit", calculateDifference);
}

initDateCalculator();
