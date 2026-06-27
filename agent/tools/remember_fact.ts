import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";

// Durable profile facts — the long-term "what the agent knows about Steven".
export default defineTool({
  description:
    "Save or update a durable fact about Steven, his family, or his preferences — e.g. a doctor's name, a clothing size, an account detail. Facts persist across conversations. (His timezone is configured separately; use current_time for that.)",
  inputSchema: z.object({
    key: z
      .string()
      .min(1)
      .describe("Short stable label, e.g. 'pediatrician' or 'daughter_shoe_size'."),
    value: z.string().min(1),
  }),
  async execute({ key, value }) {
    const fact = await store.facts.set(key, value);
    return { key: fact.key, value: fact.value, updatedAt: fact.updatedAt };
  },
});
