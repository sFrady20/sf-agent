import { defineSchedule } from "eve/schedules";
import telegram from "../channels/telegram.js";
import { googleConfigured, listEvents } from "../lib/google.js";
import { store } from "../lib/store/index.js";
import { dateInTz, hourInTz, ownerTimezone } from "../lib/time.js";

// Proactive reminder engine. Each sweep surfaces tasks/chores that have come due
// and calendar events starting soon, then nudges Telegram — but only once per
// item (dedup in the store) and only during waking hours (no 3am pings).
//
// Frequency is plan-sensitive: Vercel Pro runs `*/30` every 30 min; Hobby caps
// cron at ~once/day. Override with REMINDER_SWEEP_CRON if your plan needs it, or
// rely on the daily morning/evening briefs. Dedup requires KV — without it every
// sweep re-reminds. eve dev never fires schedules; trigger with:
//   curl -X POST http://localhost:3000/eve/v1/dev/schedules/reminder_sweep

const ACTIVE_START = 7; // 7am
const ACTIVE_END = 22; // 10pm

export default defineSchedule({
  cron: process.env.REMINDER_SWEEP_CRON ?? "*/30 * * * *",
  async run({ receive, waitUntil, appAuth }) {
    const chatId = process.env.OWNER_TELEGRAM_USER_ID;
    if (!chatId) return;

    const tz = ownerTimezone();
    const hour = hourInTz(tz);
    if (hour < ACTIVE_START || hour >= ACTIVE_END) return; // quiet hours

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
        console.warn("[reminder_sweep] calendar check failed", err);
      }
    }

    if (lines.length === 0) return;

    waitUntil(
      receive(telegram, {
        message:
          "Give Steven a brief, friendly reminder about these items. If he replies " +
          "to act on one (e.g. finish a task with complete_task), help him.\n\n" +
          lines.join("\n"),
        target: { chatId },
        auth: appAuth,
      }),
    );
  },
});
