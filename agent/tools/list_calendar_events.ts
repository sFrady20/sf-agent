import { defineTool } from "eve/tools";
import { z } from "zod";
import { listEvents } from "../lib/google.js";

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
    const events = await listEvents({
      timeMin: timeMin ?? new Date(now).toISOString(),
      timeMax: timeMax ?? new Date(now + 7 * 86_400_000).toISOString(),
      maxResults,
    });
    return { events };
  },
});
