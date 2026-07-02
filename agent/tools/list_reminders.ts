import { defineTool } from "eve/tools";
import { z } from "zod";
import { listRemoteReminders, remoteWorkerConfigured } from "../lib/remote.js";

// Pending reminders held by the home worker: timed (remind_me) and presence
// (remind_when). Returns ids for cancel_reminder.
export default defineTool({
  description:
    "List pending reminders on the home worker — timed ones (with when they fire) and presence ones (fire on getting home / leaving). Use before cancel_reminder, or when Steven asks what reminders are set.",
  inputSchema: z.object({}),
  async execute() {
    if (!remoteWorkerConfigured()) {
      return { error: "Home worker not configured: set PI_WORKER_URL and PI_WORKER_SECRET." };
    }
    try {
      return await listRemoteReminders();
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});
