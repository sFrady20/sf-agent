import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";

// Recoverability for the assume-done model: if Steven says he hasn't actually done
// something the system marked or auto-assumed as done, put it back.
export default defineTool({
  description:
    "Reopen a task that was marked done or auto-assumed done — use when Steven says he hasn't actually done it yet. Find the id with list_tasks (includeCompleted: true) or recall.",
  inputSchema: z.object({ id: z.string().min(1) }),
  async execute({ id }) {
    const task = await store.tasks.reopen(id);
    return task ? { id: task.id, title: task.title, status: task.status } : { error: "Task not found." };
  },
});
