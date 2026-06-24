import { defineEval } from "eve/evals";

// Restraint: a plain greeting shouldn't trigger tools or memory writes.
export default defineEval({
  description: "Greets back without taking actions.",
  async test(t) {
    await t.send("Hey, you there?");
    t.completed();
    t.usedNoTools().soft();
  },
});
