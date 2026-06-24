import { defineEval } from "eve/evals";

// Multi-turn: the agent records a task, then lists it back on request.
export default defineEval({
  description: "Adds a task and lists it back.",
  async test(t) {
    await t.send("Add a task: call the dentist, due 2026-07-10.");
    t.completed();
    t.calledTool("add_task").soft();

    await t.send("What tasks do I have?");
    t.completed();
    t.calledTool("list_tasks").soft();
  },
});
