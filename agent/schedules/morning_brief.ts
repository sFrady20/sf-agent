import { defineSchedule } from "eve/schedules";
import telegram from "../channels/telegram.js";
import { currentTimezone } from "../lib/location.js";
import { localNow } from "../lib/time.js";
import { summarizeWorkDay, workDayInfo } from "../lib/work-schedule.js";

// Vercel evaluates cron in UTC. "0 13 * * *" ≈ 8am US Eastern / 9am during DST.
// Trigger locally with:
//   curl -X POST http://localhost:3000/eve/v1/dev/schedules/morning_brief
export default defineSchedule({
  cron: "0 13 * * *",
  async run({ receive, waitUntil, appAuth }) {
    const chatId = process.env.OWNER_TELEGRAM_USER_ID;
    if (!chatId) {
      console.warn("[morning_brief] set OWNER_TELEGRAM_USER_ID to enable the daily brief");
      return;
    }
    const tz = await currentTimezone();
    const now = localNow(tz);
    const workLine = summarizeWorkDay(await workDayInfo(), "today");
    waitUntil(
      receive(telegram, {
        message:
          `Current time: ${now} (${tz}). ` +
          (workLine ? `Work context (background only — do NOT restate it): ${workLine} ` : "") +
          "Good morning. Give Steven a short daily brief: his calendar for today (use " +
          "list_calendar_events), any tasks or recurring chores due (use list_tasks), and " +
          "anything in the inbox worth surfacing (use recall). Don't announce whether it's a " +
          "workday or rest day — he already knows. Use the work context only to surface useful, " +
          "non-obvious things if any (a meeting that collides with an appointment, an in-office " +
          "day that changes his commute or prep). Keep it to a few bullets.",
        target: { chatId },
        auth: appAuth,
      }),
    );
  },
});
