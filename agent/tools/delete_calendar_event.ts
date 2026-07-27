import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";
import { calendarFetch, calendarId } from "../lib/google.js";

// Deletion is irreversible, so it's approval-gated like create. The id comes
// from list_calendar_events — never guess one.
export default defineTool({
  description:
    "Delete a Google Calendar event. Call list_calendar_events first to find the event, confirm with Steven which one he means, then pass its id. Asks for approval — deletion is irreversible.",
  inputSchema: z.object({
    id: z.string().min(1).describe("Event id from list_calendar_events."),
    summary: z.string().optional().describe("Event title, for the approval prompt and confirmation."),
  }),
  approval: once(),
  async execute({ id, summary }) {
    try {
      await calendarFetch(
        `/calendars/${encodeURIComponent(calendarId())}/events/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
    } catch (err) {
      const msg = (err as Error).message;
      if (/^Calendar API (404|410)/.test(msg)) {
        return { error: "Event not found — it may already be deleted." };
      }
      throw err;
    }
    return { deleted: true, id, summary };
  },
});
