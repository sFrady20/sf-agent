import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

// Multi-turn memory: capture something, then recall it later in the session.
export default defineEval({
  description: "Captures a note and recalls it on request.",
  async test(t) {
    await t.send("Remember we're out of paper towels.");
    t.completed();
    t.calledTool("capture").soft();

    await t.send("What am I out of?");
    t.completed();
    t.check(t.reply, includes("paper towels")).soft();
  },
});
