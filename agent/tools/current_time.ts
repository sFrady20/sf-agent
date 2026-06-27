import { defineTool } from "eve/tools";
import { z } from "zod";
import { isDST, isValidTimeZone, localNow, ownerTimezone, tzOffset } from "../lib/time.js";

// The host clock (NTP-synced on Vercel) is authoritative for "now"; the model
// just never had a way to read it. This hands over the current instant projected
// into a timezone with the correct DST-aware offset — no network call, so it
// can't be wrong or time out. Defaults to Steven's home zone; pass `timezone`
// to read the time where he currently is (e.g. while traveling).
export default defineTool({
  description:
    "Get the current date and time. Call this BEFORE any time-sensitive operation — creating events, setting reminders, answering 'what time is it', scheduling tasks, or reasoning about what's coming up today/tomorrow. Never guess the current date, time, or UTC offset. Defaults to Steven's home timezone; pass `timezone` to check the time somewhere else, e.g. where he is while traveling.",
  inputSchema: z.object({
    timezone: z
      .string()
      .optional()
      .describe("IANA timezone to report, e.g. 'America/Los_Angeles'. Defaults to Steven's home timezone."),
  }),
  async execute({ timezone }) {
    const home = ownerTimezone();
    const tz = timezone ?? home;
    if (!isValidTimeZone(tz)) {
      return { error: `Unknown timezone '${tz}'. Use an IANA name like America/Los_Angeles.` };
    }
    const now = new Date();
    return {
      timezone: tz,
      homeTimezone: home, // so the model can tell when the reported zone isn't home
      local: localNow(tz, now), // YYYY-MM-DDTHH:MM:SS±HH:MM
      weekday: new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(now),
      utc: now.toISOString(),
      utcOffset: tzOffset(tz, now),
      dst: isDST(tz, now),
    };
  },
});
