import { defineSchedule } from "eve/schedules";
import telegram from "../channels/telegram.js";

// Proactive daily brief delivered to Telegram (your conversational surface).
//
// Vercel evaluates cron in UTC. "0 13 * * *" ≈ 8am US Eastern / 9am during DST —
// adjust to Steven's time zone. eve dev never fires schedules; trigger one with:
//   curl -X POST http://localhost:3000/eve/v1/dev/schedules/morning_brief
//
// In a private chat the chat id equals your user id, so OWNER_TELEGRAM_USER_ID
// doubles as the delivery target. Requires TELEGRAM_BOT_TOKEN.
export default defineSchedule({
  cron: "0 13 * * *",
  async run({ receive, waitUntil, appAuth }) {
    const chatId = process.env.OWNER_TELEGRAM_USER_ID;
    if (!chatId) {
      console.warn("[morning_brief] set OWNER_TELEGRAM_USER_ID to enable the daily brief");
      return;
    }
    waitUntil(
      receive(telegram, {
        message:
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
