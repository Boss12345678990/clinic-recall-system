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

/** Today as a UTC-midnight date-only Date (server clock). */
export function todayUTC() {
  return parseDateOnly(new Date().toISOString().slice(0, 10));
}

/** Collapse a DateTime (e.g. lineSentAt, calledAt) to its UTC date-only Date. */
export function toDayStart(dateTime) {
  if (!dateTime) return null;
  return parseDateOnly(new Date(dateTime).toISOString().slice(0, 10));
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
