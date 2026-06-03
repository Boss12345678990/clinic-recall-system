// Recall-cycle domain logic (spec §7): recall-date computation plus the
// "today's to-do" four-bucket grouping that drives the front desk's day.
import { toDateOnly, toDayStart, addDays, diffDays } from './dates.js';

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

// How many calls a cycle has already made, derived from its step. The step is
// the single source of truth for progress (manual overrides can diverge from
// callLogs.length), so call counting and next-attempt numbers derive from here.
export const STEP_CALLS = { NOT_STARTED: 0, LINE_SENT: 0, CALL_1: 1, CALL_2: 2, CALL_3: 3 };
export const CONTACT_STEPS = ['NOT_STARTED', 'LINE_SENT', 'CALL_1', 'CALL_2', 'CALL_3'];

function baseItem(cycle) {
  return {
    cycleId: cycle.id,
    patientId: cycle.patientId,
    patientName: cycle.patient?.name ?? null,
    phone: cycle.patient?.phone ?? null,
    intervalMonths: cycle.patient?.intervalMonths ?? null,
    recallDate: toDateOnly(cycle.recallDate),
    step: cycle.step,
    status: cycle.status,
    lineSentAt: toDateOnly(cycle.lineSentAt),
  };
}

function lastCallDate(callLogs = []) {
  if (!callLogs.length) return null;
  return callLogs.reduce(
    (latest, log) => (new Date(log.calledAt) > new Date(latest) ? log.calledAt : latest),
    callLogs[0].calledAt
  );
}

// overdue desc, then recall date ascending (nearest first), per spec §7.
function byUrgency(a, b) {
  if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays;
  return (a.recallDate ?? '').localeCompare(b.recallDate ?? '');
}

/**
 * Partition active recall cycles into today's four buckets (spec §7).
 *
 * @param {Array} cycles  active cycles, each with patient + callLogs
 * @param {object} settings  { lineLeadDays, firstCallDelayDays, callGapDays, maxCalls }
 * @param {Date} today  UTC date-only "today"
 * @returns {{ needLine:[], needCall:[], confirmed:[], unreachable:[] }}
 */
export function groupTodayRecalls(cycles, settings, today) {
  const needLine = [];
  const needCall = [];
  const confirmed = [];
  const unreachable = [];

  for (const cycle of cycles) {
    if (!cycle.isActive) continue;

    if (cycle.status === 'CONFIRMED') {
      confirmed.push({ ...baseItem(cycle), overdueDays: diffDays(today, cycle.recallDate) });
      continue;
    }

    // status === UNCONFIRMED below.
    const callsMade = STEP_CALLS[cycle.step] ?? 0;

    // Reached the call limit and still not confirmed -> stop contacting.
    if (callsMade >= settings.maxCalls) {
      unreachable.push({ ...baseItem(cycle), overdueDays: diffDays(today, cycle.recallDate) });
      continue;
    }

    if (cycle.step === 'NOT_STARTED') {
      const due = addDays(cycle.recallDate, -settings.lineLeadDays);
      const overdueDays = diffDays(today, due);
      if (overdueDays >= 0) {
        needLine.push({ ...baseItem(cycle), dueDate: toDateOnly(due), overdueDays });
      }
      continue;
    }

    // LINE_SENT / CALL_1 / CALL_2 — eligible for the next call once the wait
    // since the previous step has elapsed.
    let due;
    let lastCallAt = null;
    if (cycle.step === 'LINE_SENT') {
      if (!cycle.lineSentAt) continue;
      due = addDays(toDayStart(cycle.lineSentAt), settings.firstCallDelayDays);
    } else {
      lastCallAt = lastCallDate(cycle.callLogs);
      if (!lastCallAt) continue;
      due = addDays(toDayStart(lastCallAt), settings.callGapDays);
    }
    const overdueDays = diffDays(today, due);
    if (overdueDays >= 0) {
      needCall.push({
        ...baseItem(cycle),
        nextCall: callsMade + 1,
        lastCallAt: toDateOnly(lastCallAt),
        dueDate: toDateOnly(due),
        overdueDays,
      });
    }
  }

  needLine.sort(byUrgency);
  needCall.sort(byUrgency);
  confirmed.sort(byUrgency);
  unreachable.sort(byUrgency);
  return { needLine, needCall, confirmed, unreachable };
}
