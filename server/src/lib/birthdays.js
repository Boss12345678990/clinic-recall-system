import { toDateOnly } from './dates.js';

// Days until the next occurrence of a month/day, ignoring year. 0 = today.
function daysUntilBirthday(birthday, today) {
  const b = new Date(birthday);
  const month = b.getUTCMonth();
  const day = b.getUTCDate();

  const y = today.getUTCFullYear();
  let next = Date.UTC(y, month, day);
  const todayMs = Date.UTC(y, today.getUTCMonth(), today.getUTCDate());
  if (next < todayMs) next = Date.UTC(y + 1, month, day); // already passed this year
  return Math.round((next - todayMs) / 86_400_000);
}

/**
 * Patients whose birthday falls within the next `days` days (inclusive of today),
 * sorted soonest first. Year is ignored.
 *
 * @param {Array} patients  [{ id, name, phone, birthday }]
 * @param {Date} today  UTC date-only
 * @param {number} days  look-ahead window (default 7)
 */
export function upcomingBirthdays(patients, today, days = 7) {
  return patients
    .filter((p) => p.birthday)
    .map((p) => ({
      id: p.id,
      name: p.name,
      phone: p.phone ?? null,
      birthday: toDateOnly(p.birthday),
      daysUntil: daysUntilBirthday(p.birthday, today),
    }))
    .filter((p) => p.daysUntil <= days)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
