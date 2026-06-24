import { defineTool } from "eve/tools";
import { z } from "zod";
import { addDraftItem, githubConfigured } from "../lib/github.js";

export default defineTool({
  description: "Add a card (draft item) to the GitHub board.",
  inputSchema: z.object({
    title: z.string().min(1),
    note: z.string().optional(),
  }),
  async execute({ title, note }) {
    if (!githubConfigured()) {
      return { error: "GitHub not configured: set GITHUB_TOKEN and GITHUB_PROJECT_ID." };
    }
    try {
      await addDraftItem(title, note);
      return { added: true, title };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});
