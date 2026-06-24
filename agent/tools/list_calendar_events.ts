import { defineTool } from "eve/tools";
import { z } from "zod";
import { calendarFetch, calendarId } from "../lib/google.js";

interface GoogleEvent {
  id?: string;
  summary?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export default defineTool({
  description:
    "List upcoming Google Calendar events. Defaults to the next 7 days from now. Use this to answer schedule and availability questions.",
  inputSchema: z.object({
    timeMin: z.string().optional().describe("ISO datetime lower bound. Defaults to now."),
    timeMax: z.string().optional().describe("ISO datetime upper bound. Defaults to 7 days out."),
    maxResults: z.number().int().min(1).max(50).optional(),
  }),
  async execute({ timeMin, timeMax, maxResults }) {
    const now = Date.now();
    const params = new URLSearchParams({
      timeMin: timeMin ?? new Date(now).toISOString(),
      timeMax: timeMax ?? new Date(now + 7 * 86_400_000).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(maxResults ?? 10),
    });
    const data = (await calendarFetch(
      `/calendars/${encodeURIComponent(calendarId())}/events?${params}`,
    )) as { items?: GoogleEvent[] };

    const events = (data.items ?? []).map((e) => ({
      id: e.id,
      summary: e.summary ?? "(no title)",
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      location: e.location,
    }));
    return { events };
  },
});
