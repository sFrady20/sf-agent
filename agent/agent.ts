import { defineAgent } from "eve";

// Sonnet 4.6 is the default for day-to-day planning and reasoning. Bump to
// "anthropic/claude-opus-4.8" for heavier planning, or drop cheap subtasks onto
// "anthropic/claude-haiku-4.5" via a subagent.
export default defineAgent({
  model: "anthropic/claude-sonnet-4.6",
});
