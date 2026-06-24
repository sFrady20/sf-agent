// Compute the next due date for a recurring chore from its free-form cadence.
// Handles the common cases (daily, weekly, biweekly, monthly, yearly, and
// "every <weekday>"); returns null when the cadence isn't recognized, in which
// case the caller leaves the task open without advancing it.

const WEEKDAYS: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const toDateOnly = (d: Date) => d.toISOString().slice(0, 10);

export function nextDue(currentDue: string | undefined, recur: string): string | null {
  const r = recur.toLowerCase();
  let base = currentDue ? new Date(currentDue) : new Date();
  if (Number.isNaN(base.getTime())) base = new Date();
  const d = new Date(base);

  const weekday = r.match(/every\s+(sun|mon|tue|wed|thu|fri|sat)/);
  if (weekday) {
    const target = WEEKDAYS[weekday[1]];
    do {
      d.setUTCDate(d.getUTCDate() + 1);
    } while (d.getUTCDay() !== target);
    return toDateOnly(d);
  }
  if (/daily|every\s+day/.test(r)) {
    d.setUTCDate(d.getUTCDate() + 1);
    return toDateOnly(d);
  }
  if (/biweekly|fortnight|every\s+other\s+week|every\s+2\s+weeks/.test(r)) {
    d.setUTCDate(d.getUTCDate() + 14);
    return toDateOnly(d);
  }
  if (/weekly|every\s+week/.test(r)) {
    d.setUTCDate(d.getUTCDate() + 7);
    return toDateOnly(d);
  }
  if (/monthly|every\s+month/.test(r)) {
    d.setUTCMonth(d.getUTCMonth() + 1);
    return toDateOnly(d);
  }
  if (/yearly|annually|every\s+year/.test(r)) {
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    return toDateOnly(d);
  }
  return null;
}
