import prisma from './prisma.js';

// Spec §6 default settings. The recall state machine reads these (never
// hard-codes thresholds) so the clinic can later retune via the settings UI
// (Phase 4) without code changes.
export const DEFAULT_SETTINGS = {
  clinicName: '牙醫診所',
  defaultInterval: 6,
  lineLeadDays: 7, // send LINE this many days before the recall date
  firstCallDelayDays: 3, // wait this long after LINE before the first call
  callGapDays: 2, // gap between phone calls
  maxCalls: 3, // stop after this many calls
  lineTemplate: '提醒您即將到了回診時間，請與診所聯繫安排回診。',
};

export const NUMERIC_KEYS = new Set([
  'defaultInterval',
  'lineLeadDays',
  'firstCallDelayDays',
  'callGapDays',
  'maxCalls',
]);

// Validate + normalize a partial settings patch. Throws Error('INVALID_SETTING')
// on a bad value. Returns rows ready to upsert.
export function validateSettingsPatch(patch = {}) {
  const rows = [];
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue; // ignore unknown keys
    if (NUMERIC_KEYS.has(key)) {
      const n = Number(value);
      if (!Number.isInteger(n) || n <= 0) throw new Error('INVALID_SETTING');
      rows.push({ key, value: String(n) });
    } else {
      const str = String(value ?? '').trim();
      if (!str) throw new Error('INVALID_SETTING');
      rows.push({ key, value: str });
    }
  }
  return rows;
}

/** Merge a list of {key,value} rows over the defaults, coercing numeric keys. */
export function mergeSettings(rows = []) {
  const settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    settings[key] = NUMERIC_KEYS.has(key) ? Number(value) : value;
  }
  return settings;
}

/** Load effective settings (DB values over defaults). */
export async function getSettings() {
  const rows = await prisma.setting.findMany();
  return mergeSettings(rows);
}

/** Seed any missing default settings into the table (idempotent, run at startup). */
export async function seedSettings() {
  await prisma.setting.createMany({
    data: Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value: String(value) })),
    skipDuplicates: true,
  });
}
