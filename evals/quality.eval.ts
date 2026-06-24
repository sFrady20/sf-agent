import { defineEval } from "eve/evals";

// LLM-as-judge: the agent's rundown should be concise and actionable. Soft —
// tracked unless run with `eve eval --strict`. Skips if no judge credentials.
export default defineEval({
  description: "A daily rundown is concise and actionable.",
  async test(t) {
    await t.send("Give me a quick rundown of what's on my plate today.");
    t.completed();
    t.judge.autoevals
      .closedQA("concise and actionable — not rambling or padded with caveats")
      .atLeast(0.6);
  },
});
