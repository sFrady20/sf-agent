import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";

// Quick-capture inbox — the core "remember this for me" action.
export default defineTool({
  description:
    "Capture a quick note, idea, or thing to remember into the inbox. Use proactively whenever Steven mentions something he wants to remember, without waiting to be asked.",
  inputSchema: z.object({
    text: z.string().min(1),
    tags: z.array(z.string()).optional(),
  }),
  async execute({ text, tags }) {
    const note = await store.notes.add(text, tags ?? []);
    return { id: note.id, text: note.text, savedAt: note.createdAt };
  },
});
