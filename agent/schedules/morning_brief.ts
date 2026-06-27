import { defineSchedule } from "eve/schedules";
import telegram from "../channels/telegram.js";
import { localNow, ownerTimezone } from "../lib/time.js";

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
    const now = localNow();
    const tz = ownerTimezone();
    waitUntil(
      receive(telegram, {
        message:
          `Current time: ${now} (${tz}). ` +
          "Good morning. Give Steven a short daily brief: today's date, his " +
          "calendar for today (use list_calendar_events), any tasks or recurring " +
          "chores due (use list_tasks), and anything in the inbox worth surfacing " +
          "(use recall). Keep it to a few bullets.",
        target: { chatId },
        auth: appAuth,
      }),
    );
  },
});
