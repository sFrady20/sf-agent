import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";
import { calendarFetch, calendarId } from "../lib/google.js";

// Writes to the calendar, so it's gated on approval (renders as a Telegram
// inline button / Discord button). Confirm details before calling.
export default defineTool({
  description:
    "Create a Google Calendar event. Confirm the title, date, and time with Steven before calling.",
  inputSchema: z.object({
    summary: z.string().min(1),
    start: z.string().describe("ISO datetime with offset, e.g. 2026-07-01T18:00:00-04:00"),
    end: z.string().describe("ISO datetime with offset"),
    description: z.string().optional(),
    location: z.string().optional(),
  }),
  needsApproval: once(),
  async execute({ summary, start, end, description, location }) {
    const event = (await calendarFetch(`/calendars/${encodeURIComponent(calendarId())}/events`, {
      method: "POST",
      body: JSON.stringify({
        summary,
        description,
        location,
        start: { dateTime: start },
        end: { dateTime: end },
      }),
    })) as { id?: string; htmlLink?: string };

    return { id: event.id, link: event.htmlLink, summary, start, end };
  },
});
