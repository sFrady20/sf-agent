import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";

// Read side of memory — search before asking Steven to repeat himself.
export default defineTool({
  description:
    "Search previously captured notes, saved facts, and tasks. Use this before asking Steven to repeat something he may have already told you.",
  inputSchema: z.object({ query: z.string().min(1) }),
  async execute({ query }) {
    const q = query.toLowerCase();
    const [notes, facts, tasks] = await Promise.all([
      store.notes.list(),
      store.facts.all(),
      store.tasks.list({ includeCompleted: true }),
    ]);
    return {
      notes: notes.filter((n) => n.text.toLowerCase().includes(q)),
      facts: facts.filter(
        (f) => f.key.toLowerCase().includes(q) || f.value.toLowerCase().includes(q),
      ),
      tasks: tasks.filter((t) => t.title.toLowerCase().includes(q)),
    };
  },
});
