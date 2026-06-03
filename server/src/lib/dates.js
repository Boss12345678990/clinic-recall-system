// Helpers for @db.Date columns (birthday, lastVisit, recallDate, visitDate).
// We store/compare these as UTC-midnight Dates so there is no timezone drift
// between what the front desk types ("YYYY-MM-DD") and what is persisted.

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a "YYYY-MM-DD" string into a UTC-midnight Date.
 * @returns {Date|null} null for empty input.
 * @throws {Error} on a malformed / invalid calendar date.
 */
export function parseDateOnly(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error('INVALID_DATE');
    return value;
  }
  const str = String(value).trim();
  if (!DATE_ONLY.test(str)) throw new Error('INVALID_DATE');
  const date = new Date(`${str}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error('INVALID_DATE');
  // Reject things like 2026-02-31 that JS would roll over.
  if (date.toISOString().slice(0, 10) !== str) throw new Error('INVALID_DATE');
  return date;
}

/** Format a Date (or null) as "YYYY-MM-DD" using its UTC date part. */
export function toDateOnly(date) {
  if (!date) return null;
  return new Date(date).toISOString().slice(0, 10);
}

// "YYYY-MM-DD" from a Date's LOCAL calendar day. The server runs on the clinic
// PC, so local time == clinic time; business-day boundaries must follow the
// clinic's midnight, not UTC (otherwise buckets shift a day near UTC midnight).
function localDateString(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today as a date-only Date anchored on the clinic-local calendar day. */
export function localToday() {
  return parseDateOnly(localDateString(new Date()));
}

/** Collapse a DateTime (lineSentAt, calledAt) to its clinic-local calendar day. */
export function toDayStart(dateTime) {
  if (!dateTime) return null;
  return parseDateOnly(localDateString(new Date(dateTime)));
}

/** A new Date `days` after `date` (UTC). */
export function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Whole-day difference a - b (positive when a is later). */
export function diffDays(a, b) {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}
