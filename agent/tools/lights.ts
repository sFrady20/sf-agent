import { defineTool } from "eve/tools";
import { z } from "zod";

// Drives the cooperative LIFX lighting daemon on the home Pi. It runs ambient
// scenes on its own; this is for explicit asks ("dim the lab", "flash the
// lights") and tuning taste. The daemon won't fight bulbs Steven changed by hand.
export default defineTool({
  description:
    "Control the home-lab ambient lighting (LIFX, via the Pi worker): set a scene, turn all lights on/off, flash for a notification, enable/disable the system, or tune taste (per-light brightness, exclude a light, avoid red). It runs cooperatively and won't override lights changed by hand.",
  inputSchema: z.object({
    action: z.enum(["status", "scene", "on", "off", "flash", "enable", "disable", "tune"]),
    scene: z.enum(["morning", "day", "evening", "night"]).optional(),
    light: z.string().optional().describe("Light label to tune; omit to tune the global default."),
    brightnessScale: z
      .number()
      .min(0)
      .max(2)
      .optional()
      .describe("Brightness multiplier: 1 normal, 1.3 brighter, 0.7 dimmer."),
    exclude: z.boolean().optional().describe("If true, the system leaves this light alone entirely."),
    avoidRed: z.boolean().optional(),
  }),
  async execute(input) {
    const url = process.env.PI_WORKER_URL;
    const secret = process.env.PI_WORKER_SECRET;
    if (!url || !secret) {
      return { error: "Home worker not configured: set PI_WORKER_URL and PI_WORKER_SECRET." };
    }
    const base = url.replace(/\/$/, "");

    let path = "/lighting";
    let method = "GET";
    let body: string | undefined;
    switch (input.action) {
      case "status":
        break;
      case "scene":
        path = "/lighting/scene";
        method = "POST";
        body = JSON.stringify({ scene: input.scene });
        break;
      case "on":
      case "off":
        path = "/lighting/power";
        method = "POST";
        body = JSON.stringify({ on: input.action === "on" });
        break;
      case "flash":
        path = "/lighting/flash";
        method = "POST";
        body = "{}";
        break;
      case "enable":
      case "disable":
        path = "/lighting/enable";
        method = "POST";
        body = JSON.stringify({ enabled: input.action === "enable" });
        break;
      case "tune":
        path = "/lighting/tune";
        method = "POST";
        body = JSON.stringify({
          light: input.light,
          brightnessScale: input.brightnessScale,
          exclude: input.exclude,
          avoidRed: input.avoidRed,
        });
        break;
    }

    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body,
      });
      if (!res.ok) return { error: `Worker ${res.status}: ${await res.text()}` };
      return await res.json();
    } catch (e) {
      return { error: (e as Error).message };
    }
  },
});
