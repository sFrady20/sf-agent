import { defineTool } from "eve/tools";
import { z } from "zod";
import { remoteWorkerConfigured, schedulePresenceReminder } from "../lib/remote.js";

// A presence reminder: the home worker fires it when Steven's phone joins ("home")
// or leaves ("away") the home WiFi, and pings Telegram.
export default defineTool({
  description:
    "Set a reminder that fires when Steven gets home or leaves, detected by his phone joining/leaving the home WiFi (e.g. 'remind me when I get home to take out the trash'). For a fixed delay use remind_me; for a calendar date use add_task.",
  inputSchema: z.object({
    message: z.string().min(1),
    trigger: z.enum(["home", "away"]),
  }),
  async execute({ message, trigger }) {
    if (!remoteWorkerConfigured()) {
      return { error: "Home worker not configured: set PI_WORKER_URL and PI_WORKER_SECRET." };
    }
    try {
      await schedulePresenceReminder(message, trigger);
      return { scheduled: true, trigger, message };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});
