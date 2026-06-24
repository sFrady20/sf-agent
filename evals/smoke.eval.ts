import { defineEval } from "eve/evals";

// Smoke test: the agent boots, accepts a message, and captures a reminder
// instead of just chatting. Asserts completion as a hard gate; tool usage is a
// soft signal so a phrasing change doesn't break the build.
export default defineEval({
  description: "The agent boots and captures a reminder to memory.",
  async test(t) {
    await t.send("Remember that trash goes out Tuesday night.");
    t.completed();
    t.calledTool("capture").soft();
  },
});
