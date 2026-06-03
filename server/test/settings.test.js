import { describe, it, expect } from 'vitest';
import { mergeSettings, DEFAULT_SETTINGS } from '../src/lib/settings.js';

describe('mergeSettings', () => {
  it('returns defaults when there are no rows', () => {
    expect(mergeSettings([])).toEqual(DEFAULT_SETTINGS);
  });

  it('overrides defaults and coerces numeric keys', () => {
    const merged = mergeSettings([
      { key: 'lineLeadDays', value: '5' },
      { key: 'maxCalls', value: '2' },
      { key: 'clinicName', value: '微笑牙醫' },
    ]);
    expect(merged.lineLeadDays).toBe(5);
    expect(merged.maxCalls).toBe(2);
    expect(merged.clinicName).toBe('微笑牙醫');
    expect(merged.firstCallDelayDays).toBe(DEFAULT_SETTINGS.firstCallDelayDays);
  });

  it('ignores unknown keys', () => {
    const merged = mergeSettings([{ key: 'bogus', value: 'x' }]);
    expect(merged).toEqual(DEFAULT_SETTINGS);
  });
});
