import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";

export default defineTool({
  description:
    "Add a task or recurring chore. Use 'recur' for repeating chores (e.g. 'weekly', 'every Tuesday', 'monthly').",
  inputSchema: z.object({
    title: z.string().min(1),
    due: z.string().optional().describe("ISO date, e.g. 2026-07-01."),
    recur: z.string().optional(),
    stakes: z
      .enum(["low", "high"])
      .optional()
      .describe(
        "'high' only for consequential tasks — bills, deadlines, appointments, anything with real consequences if missed. Default low (most tasks). Low-stakes tasks are silently assumed done after their due date; high-stakes ones never are.",
      ),
  }),
  async execute({ title, due, recur, stakes }) {
    return store.tasks.add({ title, due, recur, stakes });
  },
});
