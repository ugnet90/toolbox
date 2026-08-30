const MS_PER_DAY = 86_400_000;

export function parseIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function toIsoDate(parts) {
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

export function toUtcDate(parts) {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
}

export function fromUtcDate(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addDays(parts, days) {
  const date = toUtcDate(parts);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtcDate(date);
}

export function addMonthsClamped(parts, months) {
  const baseMonthIndex = parts.year * 12 + (parts.month - 1) + months;
  const targetYear = Math.floor(baseMonthIndex / 12);
  const targetMonthIndex = ((baseMonthIndex % 12) + 12) % 12;
  const targetMonth = targetMonthIndex + 1;
  const targetDay = Math.min(parts.day, daysInMonth(targetYear, targetMonth));

  return {
    year: targetYear,
    month: targetMonth,
    day: targetDay
  };
}

export function addPeriod(parts, amount, unit) {
  if (!Number.isInteger(amount)) {
    throw new Error("Der Zeitraum muss eine ganze Zahl sein.");
  }

  switch (unit) {
    case "days":
      return addDays(parts, amount);
    case "weeks":
      return addDays(parts, amount * 7);
    case "months":
      return addMonthsClamped(parts, amount);
    default:
      throw new Error("Unbekannte Einheit.");
  }
}

export function compareDates(a, b) {
  return Math.sign(toUtcDate(a).getTime() - toUtcDate(b).getTime());
}

export function differenceInDays(start, end) {
  return Math.round((toUtcDate(end).getTime() - toUtcDate(start).getTime()) / MS_PER_DAY);
}

export function addYearsClamped(parts, years) {
  const targetYear = parts.year + years;
  const targetDay = Math.min(parts.day, daysInMonth(targetYear, parts.month));
  return {
    year: targetYear,
    month: parts.month,
    day: targetDay
  };
}

export function fullMonthsBetween(start, end) {
  if (compareDates(start, end) > 0) {
    throw new Error("Das Enddatum darf nicht vor dem Ausgangsdatum liegen.");
  }

  let months = (end.year - start.year) * 12 + (end.month - start.month);
  if (compareDates(addMonthsClamped(start, months), end) > 0) {
    months -= 1;
  }
  return Math.max(0, months);
}

export function calendarDifference(start, end) {
  if (compareDates(start, end) > 0) {
    throw new Error("Das Enddatum darf nicht vor dem Ausgangsdatum liegen.");
  }

  let years = end.year - start.year;
  if (compareDates(addYearsClamped(start, years), end) > 0) {
    years -= 1;
  }

  const yearAnchor = addYearsClamped(start, years);
  let months = (end.year - yearAnchor.year) * 12 + (end.month - yearAnchor.month);
  if (compareDates(addMonthsClamped(yearAnchor, months), end) > 0) {
    months -= 1;
  }

  const monthAnchor = addMonthsClamped(yearAnchor, months);
  const days = differenceInDays(monthAnchor, end);

  return { years, months, days };
}

export function formatDateDe(parts) {
  return `${parts.day.toString().padStart(2, "0")}.${parts.month.toString().padStart(2, "0")}.${parts.year.toString().padStart(4, "0")}`;
}
