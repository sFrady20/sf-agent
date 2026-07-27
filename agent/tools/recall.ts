import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";

// Read side of memory — search before asking Steven to repeat himself.
// Multi-term: every word scores independently, results ranked by hits, so
// "daughter pediatrician" finds a fact matching either word (best first)
// instead of requiring the exact phrase.
export default defineTool({
  description:
    "Search previously captured notes, saved facts, tasks, Discord conversation summaries, and the rolling log of recent email traffic (sender + subject + snippet for every non-spam email, even ones background triage skipped). Use this before asking Steven to repeat something he may have already told you, for 'did anyone mention X' questions, and for 'did I get an email from X' questions. Multiple words match independently and results are ranked by relevance.",
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

    const [notes, facts, tasks, conversations, activity] = await Promise.all([
      store.notes.list(),
      store.facts.all(),
      store.tasks.list({ includeCompleted: true }),
      store.conversations.recent({ limit: 100 }),
      store.activity.recent({ limit: 200 }),
    ]);
    return {
      notes: rank(notes, (n) => [n.text, n.tags]),
      facts: rank(facts, (f) => [f.key, f.value]),
      tasks: rank(tasks, (t) => [t.title]),
      conversations: rank(conversations, (c) => [c.summary, c.channel, c.participants]),
      activity: rank(activity, (a) => [a.actor, a.title, a.summary, a.source]),
    };
  },
});
