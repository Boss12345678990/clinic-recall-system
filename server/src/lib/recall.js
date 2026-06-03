// Recall-cycle domain logic (spec §7). In Phase 1 this only computes the
// recall date; the contact state machine / today's-to-do grouping arrives in
// Phase 2 and will live here too.

/**
 * Recall date = last visit + intervalMonths (spec §3). Works in UTC so it
 * stays aligned with how date-only columns are stored (see lib/dates.js).
 *
 * @param {Date|null} lastVisit  UTC-midnight date of the most recent visit
 * @param {number} intervalMonths
 * @returns {Date|null} null when there is no lastVisit to anchor from
 */
export function computeRecallDate(lastVisit, intervalMonths) {
  if (!lastVisit) return null;
  const months = Number(intervalMonths);
  if (!Number.isInteger(months) || months <= 0) throw new Error('INVALID_INTERVAL');

  const base = new Date(lastVisit);
  const day = base.getUTCDate();
  const result = new Date(base);
  result.setUTCMonth(result.getUTCMonth() + months);
  // If the target month is shorter, JS rolls into the next month
  // (e.g. Aug 31 + 6mo -> Mar 3). Clamp back to the last day of the
  // intended month instead.
  if (result.getUTCDate() !== day) {
    result.setUTCDate(0);
  }
  return result;
}
