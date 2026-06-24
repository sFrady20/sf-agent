// Reminder selection + dedup, shared by the `cron` channel endpoint. Pure logic
// (no framework types): returns the lines to send, or null when there's nothing
// to send, it's quiet hours, or there's no owner configured. Delivery is the
// caller's job.

import { googleConfigured, listEvents } from "./google.js";
import { store } from "./store/index.js";
import { dateInTz, hourInTz, ownerTimezone } from "./time.js";

const ACTIVE_START = 7; // 7am
const ACTIVE_END = 22; // 10pm

export interface ReminderResult {
  chatId: string;
  lines: string[];
}

export async function collectReminders(): Promise<ReminderResult | null> {
  const chatId = process.env.OWNER_TELEGRAM_USER_ID;
  if (!chatId) return null;

  const tz = ownerTimezone();
  const hour = hourInTz(tz);
  if (hour < ACTIVE_START || hour >= ACTIVE_END) return null; // quiet hours

  const lines: string[] = [];

  // Tasks/chores due today or overdue — once per due date.
  const today = dateInTz(tz);
  for (const t of await store.tasks.list()) {
    if (!t.due || t.due > today) continue;
    const key = `task:${t.id}:${t.due}`;
    if (await store.reminders.was(key)) continue;
    await store.reminders.mark(key);
    lines.push(`- ${t.due < today ? "Overdue" : "Due today"}: ${t.title} (id ${t.id})`);
  }

  // Calendar events starting within the lead window — once each.
  if (googleConfigured()) {
    const lead = Number(process.env.APPOINTMENT_LEAD_MIN ?? 60);
    const now = Date.now();
    try {
      const events = await listEvents({
        timeMin: new Date(now).toISOString(),
        timeMax: new Date(now + lead * 60_000).toISOString(),
      });
      for (const e of events) {
        if (!e.start) continue;
        const key = `appt:${e.id ?? e.summary}:${e.start}`;
        if (await store.reminders.was(key)) continue;
        await store.reminders.mark(key);
        lines.push(`- Soon: ${e.summary} at ${e.start}${e.location ? ` (${e.location})` : ""}`);
      }
    } catch (err) {
      console.warn("[reminders] calendar check failed", err);
    }
  }

  return lines.length > 0 ? { chatId, lines } : null;
}

export function reminderMessage(lines: string[]): string {
  return (
    "Give Steven a brief, friendly reminder about these items. If he replies to " +
    "act on one (e.g. finish a task with complete_task), help him.\n\n" +
    lines.join("\n")
  );
}
