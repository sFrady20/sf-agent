import { defineTool } from "eve/tools";
import { z } from "zod";
import { githubConfigured, listItems, setItemStatus } from "../lib/github.js";

// Matches the card by title so opaque node ids never enter the model's context.
export default defineTool({
  description:
    "Move a card on the GitHub board to a status (e.g. 'In Progress', 'Done'). Matches the card by title.",
  inputSchema: z.object({
    title: z.string().min(1).describe("Title (or part of it) of the card."),
    status: z.string().min(1),
  }),
  async execute({ title, status }) {
    if (!githubConfigured()) {
      return { error: "GitHub not configured: set GITHUB_TOKEN and GITHUB_PROJECT_ID." };
    }
    try {
      const q = title.toLowerCase();
      const matches = (await listItems()).filter((i) => i.title.toLowerCase().includes(q));
      if (matches.length === 0) return { error: `No card matching "${title}".` };
      if (matches.length > 1) {
        return { error: `Multiple cards match "${title}": ${matches.map((m) => m.title).join("; ")}. Be more specific.` };
      }
      return await setItemStatus(matches[0].id, status);
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});
