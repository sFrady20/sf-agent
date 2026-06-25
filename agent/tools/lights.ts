import { defineTool } from "eve/tools";
import { z } from "zod";

// Drives the cooperative LIFX lighting daemon on the home Pi. For a mood/vibe
// request, DESIGN a theme (pick colors) with action "theme" — it holds until
// "auto" resumes the schedule. The daemon won't fight bulbs changed by hand.
export default defineTool({
  description:
    "Control the home-lab ambient lighting (LIFX, via the Pi). For a mood/color/vibe request, design a theme: action 'theme' with 2-4 colors and a brightness you choose (it holds until you run action 'auto'). Other actions: 'scene' (a named morning/day/evening/night look), 'on'/'off', 'flash' (notification pulse), 'enable'/'disable' the system, 'tune' (per-light brightness, exclude a light, avoid red), 'status'. It's color-first and won't override lights changed by hand.",
  inputSchema: z.object({
    action: z.enum(["status", "theme", "auto", "scene", "on", "off", "flash", "enable", "disable", "tune"]),
    colors: z
      .array(z.object({ hue: z.number().min(0).max(360), saturation: z.number().min(0).max(100) }))
      .optional()
      .describe("For 'theme': 2-4 colors you design for the vibe. Avoid red unless asked."),
    brightness: z.number().min(1).max(100).optional().describe("For 'theme': overall brightness."),
    drift: z.boolean().optional().describe("For 'theme': slowly cycle the colors over time (default true)."),
    white: z.boolean().optional().describe("For 'theme': warm white instead of color (rare)."),
    kelvin: z.number().min(1500).max(9000).optional(),
    scene: z.enum(["morning", "day", "evening", "night"]).optional(),
    light: z.string().optional().describe("Light label to tune; omit to tune the global default."),
    brightnessScale: z.number().min(0).max(2).optional().describe("Brightness multiplier: 1 normal, 1.3 brighter, 0.7 dimmer."),
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
      case "theme":
        path = "/lighting/theme";
        method = "POST";
        body = JSON.stringify({
          palette: input.colors,
          brightness: input.brightness,
          drift: input.drift,
          white: input.white,
          kelvin: input.kelvin,
        });
        break;
      case "auto":
        path = "/lighting/auto";
        method = "POST";
        body = "{}";
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
