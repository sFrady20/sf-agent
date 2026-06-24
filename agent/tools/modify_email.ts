import { defineTool } from "eve/tools";
import { z } from "zod";
import { gmailConfigured, modifyEmail } from "../lib/gmail.js";

export default defineTool({
  description: "Triage an email by id: archive it, or mark it read or unread.",
  inputSchema: z.object({
    id: z.string().min(1),
    action: z.enum(["archive", "mark_read", "mark_unread"]),
  }),
  async execute({ id, action }) {
    if (!gmailConfigured()) {
      return { error: "Gmail not configured: set GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN." };
    }
    try {
      await modifyEmail(id, action);
      return { id, action, done: true };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});
