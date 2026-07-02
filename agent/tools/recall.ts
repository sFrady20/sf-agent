import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";

// Read side of memory — search before asking Steven to repeat himself.
// Multi-term: every word scores independently, results ranked by hits, so
// "daughter pediatrician" finds a fact matching either word (best first)
// instead of requiring the exact phrase.
export default defineTool({
  description:
    "Search previously captured notes, saved facts, and tasks. Use this before asking Steven to repeat something he may have already told you. Multiple words match independently and results are ranked by relevance.",
  inputSchema: z.object({ query: z.string().min(1) }),
  async execute({ query }) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const score = (...fields: (string | string[] | undefined)[]) => {
      const hay = fields.flat().filter(Boolean).join(" ").toLowerCase();
      return terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
    };
    const rank = <T>(items: T[], hay: (item: T) => (string | string[] | undefined)[]): T[] =>
      items
        .map((item) => ({ item, hits: score(...hay(item)) }))
        .filter((r) => r.hits > 0)
        .sort((a, b) => b.hits - a.hits)
        .map((r) => r.item);

    const [notes, facts, tasks] = await Promise.all([
      store.notes.list(),
      store.facts.all(),
      store.tasks.list({ includeCompleted: true }),
    ]);
    return {
      notes: rank(notes, (n) => [n.text, n.tags]),
      facts: rank(facts, (f) => [f.key, f.value]),
      tasks: rank(tasks, (t) => [t.title]),
    };
  },
});
