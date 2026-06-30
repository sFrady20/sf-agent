import { defineAgent } from "eve";

// Example declared subagent. Demonstrates the specialist pattern: its own
// identity and instructions, invoked by the root as the `planner` tool.
export default defineAgent({
  description:
    "Break a fuzzy, multi-step goal (a trip, an errand chain, a project) into a concrete, ordered, minimal plan.",
  model: "anthropic/claude-sonnet-5",
});
