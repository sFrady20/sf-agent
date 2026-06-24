import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";

export default defineTool({
  description: "List recent captured notes in the inbox, newest first, with their ids.",
  inputSchema: z.object({ limit: z.number().int().min(1).max(50).optional() }),
  async execute({ limit }) {
    const notes = await store.notes.list();
    return { notes: notes.slice(0, limit ?? 20) };
  },
});
