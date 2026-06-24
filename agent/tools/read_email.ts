import { defineTool } from "eve/tools";
import { z } from "zod";
import { getMessage, gmailConfigured } from "../lib/gmail.js";

export default defineTool({
  description: "Read a single email's full body by id (from search_email).",
  inputSchema: z.object({ id: z.string().min(1) }),
  async execute({ id }) {
    if (!gmailConfigured()) {
      return { error: "Gmail not configured: set GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN." };
    }
    try {
      return await getMessage(id);
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});
