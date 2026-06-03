import { describe, it, expect } from 'vitest';
import { upcomingBirthdays } from '../src/lib/birthdays.js';
import { parseDateOnly } from '../src/lib/dates.js';

describe('upcomingBirthdays', () => {
  const today = parseDateOnly('2026-06-10');
  const patients = [
    { id: 1, name: 'Today', birthday: parseDateOnly('1990-06-10') }, // 0
    { id: 2, name: 'In5', birthday: parseDateOnly('1985-06-15') }, // 5
    { id: 3, name: 'In7', birthday: parseDateOnly('2000-06-17') }, // 7 (boundary)
    { id: 4, name: 'Passed', birthday: parseDateOnly('1980-06-01') }, // wraps to next year
    { id: 5, name: 'NoBday', birthday: null },
  ];

  it('returns birthdays within the window, soonest first', () => {
    const result = upcomingBirthdays(patients, today, 7);
    expect(result.map((r) => r.name)).toEqual(['Today', 'In5', 'In7']);
    expect(result[0].daysUntil).toBe(0);
    expect(result[2].daysUntil).toBe(7);
  });

  it('excludes birthdays outside the window', () => {
    const result = upcomingBirthdays(patients, today, 3);
    expect(result.map((r) => r.name)).toEqual(['Today']);
  });
});
