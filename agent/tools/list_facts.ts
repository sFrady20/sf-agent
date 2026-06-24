import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";

export default defineTool({
  description: "List all saved profile facts about Steven and his family.",
  inputSchema: z.object({}),
  async execute() {
    return { facts: await store.facts.all() };
  },
});
