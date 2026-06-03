import { describe, it, expect } from 'vitest';
import { computeRecallDate, groupTodayRecalls } from '../src/lib/recall.js';
import { parseDateOnly, toDateOnly } from '../src/lib/dates.js';
import { DEFAULT_SETTINGS } from '../src/lib/settings.js';

describe('computeRecallDate', () => {
  it('adds the interval in months', () => {
    const recall = computeRecallDate(parseDateOnly('2026-01-15'), 6);
    expect(toDateOnly(recall)).toBe('2026-07-15');
  });

  it('clamps to the last day when the target month is shorter', () => {
    // Aug 31 + 6 months would roll into March; clamp to end of February.
    const recall = computeRecallDate(parseDateOnly('2025-08-31'), 6);
    expect(toDateOnly(recall)).toBe('2026-02-28');
  });

  it('returns null without a last visit', () => {
    expect(computeRecallDate(null, 6)).toBeNull();
  });

  it('rejects a non-positive interval', () => {
    expect(() => computeRecallDate(parseDateOnly('2026-01-15'), 0)).toThrow();
  });
});

describe('groupTodayRecalls', () => {
  const today = parseDateOnly('2026-06-10');
  let nextId = 1;
  const cycle = (over) => ({
    id: nextId++,
    patientId: 100 + nextId,
    patient: { name: `P${nextId}`, phone: '0900', status: 'ACTIVE' },
    isActive: true,
    status: 'UNCONFIRMED',
    step: 'NOT_STARTED',
    lineSentAt: null,
    callLogs: [],
    ...over,
  });

  it('puts a NOT_STARTED cycle inside the LINE lead window into needLine', () => {
    const c = cycle({ recallDate: parseDateOnly('2026-06-15') }); // due = 06-08
    const g = groupTodayRecalls([c], DEFAULT_SETTINGS, today);
    expect(g.needLine).toHaveLength(1);
    expect(g.needLine[0].overdueDays).toBe(2);
  });

  it('excludes a NOT_STARTED cycle still before the lead window', () => {
    const c = cycle({ recallDate: parseDateOnly('2026-07-01') }); // due = 06-24
    const g = groupTodayRecalls([c], DEFAULT_SETTINGS, today);
    expect(g.needLine).toHaveLength(0);
  });

  it('moves LINE_SENT to needCall once the first-call delay has elapsed', () => {
    const c = cycle({
      step: 'LINE_SENT',
      lineSentAt: new Date('2026-06-05T09:00:00Z'), // +3 -> due 06-08
      recallDate: parseDateOnly('2026-06-15'),
    });
    const g = groupTodayRecalls([c], DEFAULT_SETTINGS, today);
    expect(g.needCall).toHaveLength(1);
    expect(g.needCall[0].nextCall).toBe(1);
  });

  it('keeps LINE_SENT out of needCall before the delay elapses', () => {
    const c = cycle({
      step: 'LINE_SENT',
      lineSentAt: new Date('2026-06-09T09:00:00Z'), // +3 -> due 06-12 (future)
      recallDate: parseDateOnly('2026-06-15'),
    });
    const g = groupTodayRecalls([c], DEFAULT_SETTINGS, today);
    expect(g.needCall).toHaveLength(0);
  });

  it('offers the next call after the call gap (CALL_1 -> nextCall 2)', () => {
    const c = cycle({
      step: 'CALL_1',
      recallDate: parseDateOnly('2026-06-08'),
      callLogs: [{ attemptNo: 1, calledAt: new Date('2026-06-07T09:00:00Z') }], // +2 -> 06-09
    });
    const g = groupTodayRecalls([c], DEFAULT_SETTINGS, today);
    expect(g.needCall).toHaveLength(1);
    expect(g.needCall[0].nextCall).toBe(2);
  });

  it('routes a third-call, still-unconfirmed cycle to unreachable', () => {
    const c = cycle({ step: 'CALL_3', recallDate: parseDateOnly('2026-06-01') });
    const g = groupTodayRecalls([c], DEFAULT_SETTINGS, today);
    expect(g.unreachable).toHaveLength(1);
    expect(g.needCall).toHaveLength(0);
  });

  it('routes a CONFIRMED cycle to confirmed regardless of step', () => {
    const c = cycle({ status: 'CONFIRMED', step: 'CALL_1', recallDate: parseDateOnly('2026-06-15') });
    const g = groupTodayRecalls([c], DEFAULT_SETTINGS, today);
    expect(g.confirmed).toHaveLength(1);
  });

  it('ignores inactive cycles', () => {
    const c = cycle({ isActive: false, recallDate: parseDateOnly('2026-06-15') });
    const g = groupTodayRecalls([c], DEFAULT_SETTINGS, today);
    expect(g.needLine).toHaveLength(0);
  });

  it('sorts the most overdue first', () => {
    const a = cycle({ recallDate: parseDateOnly('2026-06-15') }); // overdue 2
    const b = cycle({ recallDate: parseDateOnly('2026-06-11') }); // due 06-04, overdue 6
    const g = groupTodayRecalls([a, b], DEFAULT_SETTINGS, today);
    expect(g.needLine.map((i) => i.overdueDays)).toEqual([6, 2]);
  });
});

describe('parseDateOnly', () => {
  it('parses YYYY-MM-DD at UTC midnight', () => {
    expect(parseDateOnly('2026-03-01').toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('returns null for empty input', () => {
    expect(parseDateOnly('')).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
  });

  it('rejects malformed and impossible dates', () => {
    expect(() => parseDateOnly('2026-13-01')).toThrow();
    expect(() => parseDateOnly('2026-02-31')).toThrow();
    expect(() => parseDateOnly('not-a-date')).toThrow();
  });
});
