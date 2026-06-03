import { describe, it, expect } from 'vitest';
import { computeRecallDate } from '../src/lib/recall.js';
import { parseDateOnly, toDateOnly } from '../src/lib/dates.js';

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
