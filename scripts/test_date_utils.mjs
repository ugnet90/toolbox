import assert from "node:assert/strict";
import {
  addPeriod,
  calendarDifference,
  differenceInDays,
  fullMonthsBetween,
  parseIsoDate,
  toIsoDate
} from "../docs/js/date-utils.js";

const d = (value) => parseIsoDate(value);

assert.equal(toIsoDate(addPeriod(d("2026-01-31"), 1, "months")), "2026-02-28");
assert.equal(toIsoDate(addPeriod(d("2024-01-31"), 1, "months")), "2024-02-29");
assert.equal(toIsoDate(addPeriod(d("2026-03-01"), -1, "days")), "2026-02-28");
assert.equal(toIsoDate(addPeriod(d("2026-08-30"), 2, "weeks")), "2026-09-13");
assert.equal(differenceInDays(d("2026-08-01"), d("2026-08-30")), 29);
assert.equal(fullMonthsBetween(d("2026-01-31"), d("2026-02-28")), 1);
assert.deepEqual(calendarDifference(d("2026-01-31"), d("2026-02-28")), { years: 0, months: 1, days: 0 });
assert.deepEqual(calendarDifference(d("2024-02-29"), d("2025-02-28")), { years: 1, months: 0, days: 0 });
assert.deepEqual(calendarDifference(d("1970-03-15"), d("2026-08-30")), {
  years: 56,
  months: 5,
  days: 15
});

console.log("OK: date-utils tests passed.");
