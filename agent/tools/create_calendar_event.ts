import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";
import { calendarFetch, calendarId } from "../lib/google.js";
import { currentTimezone } from "../lib/location.js";
import { isValidTimeZone, stripOffset } from "../lib/time.js";

// Sends the wall-clock time plus an explicit IANA timeZone, so Google resolves
// the UTC offset (incl. DST) from its own tz database — not from an offset the
// model guessed. The naive wall-clock is what Steven actually said ("6pm"); any
// offset the model attached is discarded. Defaults to his current zone (travel
// override if set, else home); accepts an explicit `timezone` to override.
export default defineTool({
  description:
    "Create a Google Calendar event. Call current_time first, then confirm the title, date, and time with Steven before calling. Pass the local wall-clock time (an offset is optional and will be recomputed). Defaults to Steven's current timezone; pass `timezone` when the event is in a different zone.",
  inputSchema: z.object({
    summary: z.string().min(1),
    start: z.string().describe("Local datetime, e.g. 2026-07-01T18:00:00"),
    end: z.string().describe("Local datetime, e.g. 2026-07-01T19:00:00"),
    description: z.string().optional(),
    location: z.string().optional(),
    timezone: z
      .string()
      .optional()
      .describe(
        "IANA timezone the wall-clock time is in, e.g. 'America/Los_Angeles'. Defaults to Steven's current timezone.",
      ),
  }),
  needsApproval: once(),
  async execute({ summary, start, end, description, location, timezone }) {
    const tz = timezone ?? (await currentTimezone());
    if (!isValidTimeZone(tz)) {
      return { error: `Unknown timezone '${tz}'. Use an IANA name like America/Los_Angeles.` };
    }
    const startLocal = stripOffset(start);
    const endLocal = stripOffset(end);

    const event = (await calendarFetch(`/calendars/${encodeURIComponent(calendarId())}/events`, {
      method: "POST",
      body: JSON.stringify({
        summary,
        description,
        location,
        start: { dateTime: startLocal, timeZone: tz },
        end: { dateTime: endLocal, timeZone: tz },
      }),
    })) as { id?: string; htmlLink?: string };

    return { id: event.id, link: event.htmlLink, summary, start: startLocal, end: endLocal, timeZone: tz };
  },
});
