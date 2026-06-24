import { defineEval } from "eve/evals";

// The agent reaches for the harmonic-mixing tool rather than guessing keys.
export default defineEval({
  description: "Suggests harmonic mixes for a DJ key.",
  async test(t) {
    await t.send("I'm playing a track in 8A — what mixes well with it?");
    t.completed();
    t.calledTool("harmonic_matches").soft();
  },
});
