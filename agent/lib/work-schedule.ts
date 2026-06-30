// Resolves Steven's work rhythm for a given day so the proactive briefs reason
// deterministically instead of guessing (the "rest day" bug). Dated exceptions
// beat the weekly pattern, mirroring how a travel override beats the home zone.

import { currentTimezone } from "./location.js";
import { store } from "./store/index.js";
import type { Weekday, WorkMeeting } from "./store/types.js";
import { WEEKDAYS } from "./store/types.js";
import { dateInTz } from "./time.js";

export interface WorkDayInfo {
  date: string; // YYYY-MM-DD
  weekday: Weekday;
  workday: boolean;
  start?: string;
  end?: string;
  location?: "office" | "remote";
  meetings: WorkMeeting[];
  note?: string; // exception note, e.g. "PTO"
  configured: boolean; // false when no schedule is set at all
}

// Weekday of a calendar date (tz-independent — a date has a fixed weekday). Noon
// UTC dodges any midnight/DST edge.
function weekdayOf(date: string): Weekday {
  const idx = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0=Sun
  return WEEKDAYS[(idx + 6) % 7]; // shift so Mon=0
}

// Work info for `date` (default: today in Steven's effective timezone).
export async function workDayInfo(date?: string): Promise<WorkDayInfo> {
  const tz = await currentTimezone();
  const day = date ?? dateInTz(tz);
  const weekday = weekdayOf(day);
  const schedule = await store.workSchedule.get();
  if (!schedule) {
    return { date: day, weekday, workday: false, meetings: [], configured: false };
  }

  const base = schedule.days[weekday];
  const exc = schedule.exceptions.find((e) => e.date === day);
  let workday = !!base;
  let location = base?.location;
  let note: string | undefined;

  if (exc) {
    note = exc.note;
    if (exc.kind === "off") workday = false;
    else {
      workday = true; // office/remote/custom all imply working
      if (exc.kind === "office" || exc.kind === "remote") location = exc.kind;
    }
  }

  const meetings = workday ? schedule.meetings.filter((m) => m.days.includes(weekday)) : [];
  return {
    date: day,
    weekday,
    workday,
    start: workday ? base?.start : undefined,
    end: workday ? base?.end : undefined,
    location,
    meetings,
    note,
    configured: true,
  };
}

// One-line summary for a brief prompt, or null when no schedule is configured
// (so the brief simply says nothing about work rather than guessing).
export function summarizeWorkDay(info: WorkDayInfo, when: "today" | "tomorrow"): string | null {
  if (!info.configured) return null;
  const label = `Work ${when}`;
  if (!info.workday) return `${label}: day off${info.note ? ` (${info.note})` : ""}.`;

  const bits = ["workday"];
  if (info.location) bits.push(info.location === "office" ? "in office" : "remote");
  if (info.start) bits.push(`${info.start}${info.end ? `–${info.end}` : ""}`);
  let s = `${label}: ${bits.join(", ")}.`;
  if (info.note) s += ` Note: ${info.note}.`;
  if (info.meetings.length) {
    s += ` Meetings: ${info.meetings.map((m) => `${m.title} ${m.start}`).join(", ")}.`;
  }
  return s;
}
