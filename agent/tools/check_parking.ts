import { defineTool } from "eve/tools";
import { z } from "zod";
import { checkRemoteParking, remoteWorkerConfigured } from "../lib/remote.js";

// One-shot look at the parking camera: the home Pi grabs a frame from the Wyze
// cam and a cheap vision model counts open spots. Takes ~10-30 seconds.
export default defineTool({
  description:
    "Check the parking camera right now and report how many parking spots are open. " +
    "Use when Steven asks whether a spot is free at this moment. To be told when one " +
    "opens up later, use watch_parking instead.",
  inputSchema: z.object({}),
  async execute() {
    if (!remoteWorkerConfigured()) {
      return { error: "Home worker not configured: set PI_WORKER_URL and PI_WORKER_SECRET." };
    }
    try {
      return await checkRemoteParking();
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});
