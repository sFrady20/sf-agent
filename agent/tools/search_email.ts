import { defineTool } from "eve/tools";
import { z } from "zod";
import { gmailConfigured, searchMessages } from "../lib/gmail.js";

export default defineTool({
  description:
    "Search Gmail using Gmail query syntax (e.g. 'is:unread', 'from:client newer_than:7d'). Returns sender, subject, date, and a snippet.",
  inputSchema: z.object({
    query: z.string().min(1),
    max: z.number().int().min(1).max(25).optional(),
  }),
  async execute({ query, max }) {
    if (!gmailConfigured()) {
      return { error: "Gmail not configured: set GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN." };
    }
    try {
      return { results: await searchMessages(query, max ?? 10) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});
