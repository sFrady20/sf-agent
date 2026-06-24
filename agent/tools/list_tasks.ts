import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";

export default defineTool({
  description:
    "List open tasks and recurring chores, soonest due first. Set includeCompleted to also show finished ones.",
  inputSchema: z.object({ includeCompleted: z.boolean().optional() }),
  async execute({ includeCompleted }) {
    return { tasks: await store.tasks.list({ includeCompleted }) };
  },
});
