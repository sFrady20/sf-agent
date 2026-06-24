import { defineTool } from "eve/tools";
import { z } from "zod";
import { githubConfigured, listItems } from "../lib/github.js";

// Token-frugal: returns just titles + status (no ids/urls), so "what am I
// working on" stays cheap.
export default defineTool({
  description:
    "List current work/projects from the GitHub board. Use this for 'what am I working on'. Optionally filter by status.",
  inputSchema: z.object({
    status: z.string().optional().describe("Optional status filter, e.g. 'In Progress'."),
  }),
  async execute({ status }) {
    if (!githubConfigured()) {
      return { error: "GitHub not configured: set GITHUB_TOKEN and GITHUB_PROJECT_ID." };
    }
    try {
      const items = (await listItems())
        .map((i) => ({ title: i.title, status: i.status ?? "No status" }))
        .filter((i) => !status || i.status.toLowerCase() === status.toLowerCase());
      return { count: items.length, items };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});
