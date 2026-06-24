import { defineTool } from "eve/tools";
import { z } from "zod";

// Hands a short-fuse, delayed reminder to the always-on home worker (a Raspberry
// Pi reachable over Tailscale Funnel). Vercel functions are too short-lived to
// hold a timer; the worker waits and pings Telegram when it fires.
export default defineTool({
  description:
    "Set a reminder that fires after a delay from now (e.g. 'remind me in 55 minutes to go to the grocery store'). Runs on Steven's always-on home worker and pings Telegram when it fires. For a specific calendar date/time, use add_task or create_calendar_event instead.",
  inputSchema: z.object({
    message: z.string().min(1),
    in_minutes: z.number().positive().describe("Minutes from now until the reminder fires."),
  }),
  async execute({ message, in_minutes }) {
    const url = process.env.PI_WORKER_URL;
    const secret = process.env.PI_WORKER_SECRET;
    if (!url || !secret) {
      return { error: "Home worker not configured: set PI_WORKER_URL and PI_WORKER_SECRET." };
    }
    try {
      const res = await fetch(`${url.replace(/\/$/, "")}/jobs`, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reminder",
          message,
          delaySeconds: Math.round(in_minutes * 60),
        }),
      });
      if (!res.ok) return { error: `Worker ${res.status}: ${await res.text()}` };
      const data = (await res.json()) as { id: string; fireAt: string };
      return { scheduled: true, message, fireAt: data.fireAt };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});
