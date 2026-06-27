import { defineTool } from "eve/tools";
import { z } from "zod";
import { currentTimezone } from "../lib/location.js";
import { isDST, isValidTimeZone, localNow, ownerTimezone, tzOffset } from "../lib/time.js";

// The host clock (NTP-synced on Vercel) is authoritative for "now"; the model
// just never had a way to read it. This hands over the current instant projected
// into a timezone with the correct DST-aware offset — no network call, so it
// can't be wrong or time out. Defaults to Steven's effective zone (his travel
// override if set via set_location, else home); pass `timezone` to read another.
export default defineTool({
  description:
    "Get the current date and time. Call this BEFORE any time-sensitive operation — creating events, setting reminders, answering 'what time is it', scheduling tasks, or reasoning about what's coming up today/tomorrow. Never guess the current date, time, or UTC offset. Defaults to where Steven currently is (his travel zone if set, else home); pass `timezone` to check somewhere else.",
  inputSchema: z.object({
    timezone: z
      .string()
      .optional()
      .describe("IANA timezone to report, e.g. 'America/Los_Angeles'. Defaults to Steven's current zone."),
  }),
  async execute({ timezone }) {
    const home = ownerTimezone();
    const tz = timezone ?? (await currentTimezone());
    if (!isValidTimeZone(tz)) {
      return { error: `Unknown timezone '${tz}'. Use an IANA name like America/Los_Angeles.` };
    }
    const now = new Date();
    return {
      timezone: tz,
      homeTimezone: home, // so the model can tell when the reported zone isn't home
      traveling: tz !== home,
      local: localNow(tz, now), // YYYY-MM-DDTHH:MM:SS±HH:MM
      weekday: new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(now),
      utc: now.toISOString(),
      utcOffset: tzOffset(tz, now),
      dst: isDST(tz, now),
    };
  },
});
