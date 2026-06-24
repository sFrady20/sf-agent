import { defineSchedule } from "eve/schedules";
import telegram from "../channels/telegram.js";

// Evening review delivered to Telegram. "0 1 * * *" UTC ≈ 8–9pm US Eastern —
// adjust to Steven's time zone. eve dev never fires schedules; trigger one with:
//   curl -X POST http://localhost:3000/eve/v1/dev/schedules/evening_review
export default defineSchedule({
  cron: "0 1 * * *",
  async run({ receive, waitUntil, appAuth }) {
    const chatId = process.env.OWNER_TELEGRAM_USER_ID;
    if (!chatId) {
      console.warn("[evening_review] set OWNER_TELEGRAM_USER_ID to enable the evening review");
      return;
    }
    waitUntil(
      receive(telegram, {
        message:
          "Evening review for Steven: which tasks or chores are still open or " +
          "overdue (use list_tasks), anything left in the inbox to handle (use " +
          "list_inbox), and a heads-up on tomorrow — tomorrow's calendar (use " +
          "list_calendar_events with tomorrow's date range) and anything due " +
          "tomorrow. Two to four bullets, encouraging tone.",
        target: { chatId },
        auth: appAuth,
      }),
    );
  },
});
