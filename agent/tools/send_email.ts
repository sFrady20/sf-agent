import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { gmailConfigured, sendEmail } from "../lib/gmail.js";

// Sending is irreversible, so every send is gated on approval (renders as a
// Telegram/Discord button). Confirm recipient, subject, and body first.
export default defineTool({
  description:
    "Send an email from Steven's Gmail. Always confirm the recipient, subject, and body with him before calling.",
  inputSchema: z.object({
    to: z.string().min(1),
    subject: z.string(),
    body: z.string(),
  }),
  needsApproval: always(),
  async execute({ to, subject, body }) {
    if (!gmailConfigured()) {
      return { error: "Gmail not configured: set GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN." };
    }
    try {
      const { id } = await sendEmail(to, subject, body);
      return { sent: true, id, to, subject };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});
