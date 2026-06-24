import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";

// Keep the inbox tidy: remove a captured note once it's been acted on.
export default defineTool({
  description:
    "Remove a note from the inbox once it's been handled. Use the note id from list_inbox or recall.",
  inputSchema: z.object({ id: z.string().min(1) }),
  async execute({ id }) {
    const deleted = await store.notes.delete(id);
    return deleted ? { id, deleted: true } : { id, deleted: false, error: "Note not found." };
  },
});
