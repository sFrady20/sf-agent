import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  remoteParkingStatus,
  remoteWorkerConfigured,
  stopRemoteParkingWatch,
  watchRemoteParking,
} from "../lib/remote.js";

// Timed parking watch on the home Pi: it re-checks the camera on an interval
// and pings Telegram the moment a spot opens (then stops, by default).
export default defineTool({
  description:
    "Start, stop, or inspect a parking watch. The home worker re-checks the parking " +
    "camera every couple of minutes and pings Steven on Telegram as soon as a spot " +
    "opens. Use when he asks to be told when a spot frees up. action='status' reports " +
    "the current watch and last result.",
  inputSchema: z.object({
    action: z.enum(["start", "stop", "status"]).default("start"),
    minutes: z.number().positive().max(720).optional().describe("Watch window in minutes (default 60)."),
    interval_seconds: z
      .number()
      .min(30)
      .max(3600)
      .optional()
      .describe("Seconds between checks (default 120)."),
    keep_watching: z
      .boolean()
      .optional()
      .describe("Keep checking after the first open spot instead of stopping (default false)."),
  }),
  async execute({ action, minutes, interval_seconds, keep_watching }) {
    if (!remoteWorkerConfigured()) {
      return { error: "Home worker not configured: set PI_WORKER_URL and PI_WORKER_SECRET." };
    }
    try {
      if (action === "stop") {
        const stopped = await stopRemoteParkingWatch();
        return stopped ? { stopped: true } : { stopped: false, note: "No watch was running." };
      }
      if (action === "status") return await remoteParkingStatus();
      const started = await watchRemoteParking({
        minutes,
        intervalSeconds: interval_seconds,
        stopWhenOpen: !keep_watching,
      });
      return { watching: true, ...started };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});
