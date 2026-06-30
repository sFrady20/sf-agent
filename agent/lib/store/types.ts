// Domain types for the agent's durable memory. Kept storage-agnostic so the
// backend (in-memory, Vercel KV, Postgres) can change without touching callers.

export interface Note {
  id: string;
  text: string;
  tags: string[];
  createdAt: string; // ISO 8601
}

export interface Fact {
  key: string; // short stable label, e.g. "pediatrician"
  value: string;
  updatedAt: string; // ISO 8601
}

// A travel-timezone override. When set (and not past `until`), it replaces the
// configured home zone for all time reasoning. Absent = Steven is home.
export interface Location {
  timezone: string; // IANA, e.g. "America/Denver"
  label?: string; // optional place name, e.g. "Denver"
  until?: string; // ISO date (YYYY-MM-DD); reverts home after this day
  setAt: string; // ISO 8601
}

// Steven's recurring work rhythm. Structured (not free-form memory) because the
// proactive briefs must reason over it deterministically — otherwise they guess,
// e.g. calling a workday a "rest day". Job-agnostic and swappable: one record to
// overwrite when the job changes. The long tail (employer, people, projects) stays
// in facts/notes where the model already does fine.
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface WorkDayPattern {
  start?: string; // "09:00"
  end?: string; // "17:00"
  location?: "office" | "remote";
}

export interface WorkMeeting {
  title: string; // e.g. "Standup"
  days: Weekday[]; // which days it recurs
  start: string; // "09:30"
  end?: string;
  location?: string; // free-form, e.g. "Zoom" or "Room 4"
}

// A dated override that beats the weekly pattern (PTO, holiday, WFH-today,
// go-in-today) — same idea as a travel override beating the home timezone.
export interface WorkException {
  date: string; // YYYY-MM-DD
  kind: "off" | "office" | "remote" | "custom"; // off = not working; others = working
  note?: string; // e.g. "PTO", "Holiday"
}

export interface WorkSchedule {
  days: Partial<Record<Weekday, WorkDayPattern>>; // only the days he works
  meetings: WorkMeeting[];
  exceptions: WorkException[];
  updatedAt: string; // ISO 8601
}

export type TaskStatus = "open" | "done";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  due?: string; // ISO date
  recur?: string; // free-form cadence, e.g. "weekly", "every Tuesday"
  createdAt: string;
  completedAt?: string;
  lastCompletedAt?: string; // recurring chores: last time it was checked off
  stakes?: "low" | "high"; // "high" = consequential; never silently assumed done
  closedReason?: "done" | "assumed" | "email" | "calendar" | "expired";
}
