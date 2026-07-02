// Compute the next due date for a recurring chore from its free-form cadence.
// Handles the common cases (daily, weekly, biweekly, monthly, yearly, and
// "every <weekday>"); returns null when the cadence isn't recognized, in which
// case the caller leaves the task open without advancing it.
//
// All math is date-only. Dates are anchored at noon UTC so weekday/day arithmetic
// can never slip a day over DST or midnight. Callers pass `today` as the owner's
// local date (dateInTz) — never the raw UTC instant, which is already "tomorrow"
// during a US evening.

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

// Noon-UTC anchor for a YYYY-MM-DD string; null when it doesn't parse.
function anchor(date: string | undefined): Date | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function nextDue(currentDue: string | undefined, recur: string, today?: string): string | null {
  const r = recur.toLowerCase();
  const d = anchor(currentDue) ?? anchor(today) ?? new Date(`${toDateOnly(new Date())}T12:00:00Z`);

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

// Catch-up advance: the next occurrence strictly after `today`, no matter how
// overdue the chore is. Shared by complete_task and the reconcile sweep so a
// long-overdue weekly chore never rolls to a date still in the past.
export function nextDueAfter(
  currentDue: string | undefined,
  recur: string,
  today: string,
): string | null {
  let due = nextDue(currentDue, recur, today);
  for (let i = 0; i < 100 && due !== null && due <= today; i++) {
    const n = nextDue(due, recur, today);
    if (!n || n === due) break;
    due = n;
  }
  return due;
}
