import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";
import { isValidTimeZone, ownerTimezone } from "../lib/time.js";

// Records where Steven currently is so every time-aware path (current_time,
// calendar writes, reminders, the daily brief) follows him while traveling.
// Omit `timezone` when he's back home to revert to his configured home zone.
export default defineTool({
  description:
    "Set Steven's current timezone while he's traveling, so all time tools and reminders use it instead of his home zone. Call this when he says where he is (e.g. 'I'm in Denver until Sunday'). Omit `timezone` to clear it and revert to home when he's back.",
  inputSchema: z.object({
    timezone: z
      .string()
      .optional()
      .describe("IANA timezone he's currently in, e.g. 'America/Denver'. Omit to revert to home."),
    label: z.string().optional().describe("Optional place name, e.g. 'Denver'."),
    until: z
      .string()
      .optional()
      .describe("Optional ISO date (YYYY-MM-DD) the trip ends; reverts to home automatically after."),
  }),
  async execute({ timezone, label, until }) {
    if (!timezone) {
      await store.location.clear();
      return { cleared: true, timezone: ownerTimezone() };
    }
    if (!isValidTimeZone(timezone)) {
      return { error: `Unknown timezone '${timezone}'. Use an IANA name like America/Denver.` };
    }
    if (until && !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
      return { error: "until must be a date like 2026-07-05." };
    }
    const loc = await store.location.set({ timezone, label, until });
    return { set: true, ...loc, homeTimezone: ownerTimezone() };
  },
});
