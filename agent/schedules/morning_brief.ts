import { defineSchedule } from "eve/schedules";
import discord from "../channels/discord.js";

// Proactive daily brief delivered to Discord.
//
// Vercel evaluates cron in UTC. "0 13 * * *" ≈ 8am US Eastern / 9am during DST —
// adjust to Steven's time zone. eve dev never fires schedules; trigger one with:
//   curl -X POST http://localhost:3000/eve/v1/dev/schedules/morning_brief
//
// Requires OWNER_DISCORD_CHANNEL_ID (where to post) and DISCORD_BOT_TOKEN.
export default defineSchedule({
  cron: "0 13 * * *",
  async run({ receive, waitUntil, appAuth }) {
    const channelId = process.env.OWNER_DISCORD_CHANNEL_ID;
    if (!channelId) {
      console.warn("[morning_brief] set OWNER_DISCORD_CHANNEL_ID to enable the daily brief");
      return;
    }
    waitUntil(
      receive(discord, {
        message:
          "Good morning. Give Steven a short daily brief: today's date, any tasks " +
          "or recurring chores due (use list_tasks), and anything in the inbox " +
          "worth surfacing (use recall). Keep it to a few bullets.",
        target: { channelId },
        auth: appAuth,
      }),
    );
  },
});
