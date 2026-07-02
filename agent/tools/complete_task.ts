import { defineTool } from "eve/tools";
import { z } from "zod";
import { currentTimezone } from "../lib/location.js";
import { nextDueAfter } from "../lib/recurrence.js";
import { store } from "../lib/store/index.js";
import { dateInTz } from "../lib/time.js";

export default defineTool({
  description:
    "Mark a task or chore done. A recurring chore rolls forward to its next occurrence instead of closing.",
  inputSchema: z.object({ id: z.string().min(1) }),
  async execute({ id }) {
    const task = await store.tasks.get(id);
    if (!task) return { error: "Task not found." };

    if (task.recur) {
      task.lastCompletedAt = new Date().toISOString();
      // Catch-up advance so a long-overdue chore rolls to a real future date.
      const today = dateInTz(await currentTimezone());
      const next = nextDueAfter(task.due, task.recur, today);
      if (next) {
        task.due = next;
        task.status = "open";
        await store.tasks.save(task);
        return { id: task.id, title: task.title, recurred: true, nextDue: next };
      }
      // Cadence not recognized: record completion but leave it open.
      await store.tasks.save(task);
      return {
        id: task.id,
        title: task.title,
        recurred: true,
        nextDue: null,
        note: "Couldn't parse the cadence; left it open with no new due date.",
      };
    }

    const done = await store.tasks.complete(id);
    return { id: done?.id, title: done?.title, status: "done" };
  },
});
