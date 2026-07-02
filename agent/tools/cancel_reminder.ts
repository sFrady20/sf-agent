import { defineTool } from "eve/tools";
import { z } from "zod";
import { cancelRemoteReminder, remoteWorkerConfigured } from "../lib/remote.js";

// Cancel a pending timed or presence reminder by id (from list_reminders).
export default defineTool({
  description:
    "Cancel a pending reminder on the home worker (timed or presence). Get the id from list_reminders first.",
  inputSchema: z.object({ id: z.string().min(1) }),
  async execute({ id }) {
    if (!remoteWorkerConfigured()) {
      return { error: "Home worker not configured: set PI_WORKER_URL and PI_WORKER_SECRET." };
    }
    try {
      const canceled = await cancelRemoteReminder(id);
      return canceled ? { canceled: true, id } : { error: "No reminder with that id." };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});
