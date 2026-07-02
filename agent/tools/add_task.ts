import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";

export default defineTool({
  description:
    "Add a task or recurring chore. Use 'recur' for repeating chores (e.g. 'weekly', 'every Tuesday', 'monthly').",
  inputSchema: z.object({
    title: z.string().min(1),
    due: z.string().optional().describe("Calendar date, YYYY-MM-DD (e.g. 2026-07-01) — never a phrase like 'next Tuesday'."),
    recur: z.string().optional(),
    stakes: z
      .enum(["low", "high"])
      .optional()
      .describe(
        "'high' only for consequential tasks — bills, deadlines, appointments, anything with real consequences if missed. Default low (most tasks). Low-stakes tasks are silently assumed done after their due date; high-stakes ones never are.",
      ),
  }),
  async execute({ title, due, recur, stakes }) {
    // Due dates are compared as strings everywhere (reminders, reconcile), so a
    // free-form phrase would silently break sorting and decay. Reject it here.
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
      return { error: `due must be a date like 2026-07-01 (got "${due}"). Call current_time to resolve relative dates.` };
    }
    return store.tasks.add({ title, due, recur, stakes });
  },
});
