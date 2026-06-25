---
description: Use when Steven asks about the home-lab lighting — setting a mood/color theme or vibe, turning lights on/off, or tuning the lighting.
---

The lab lights (LIFX) run a cooperative, color-first ambient system on the Pi,
driven by the `lights` tool.

- For a **mood, vibe, or color theme** ("calming night coding colors", "something
  energizing"), **design it yourself**: pick 2–4 specific colors (hue + saturation)
  and a brightness that fit the mood, and apply them with action `theme`. Do NOT
  fall back to a named scene for a vibe request. Default to color; use white only
  if asked. Avoid red unless asked.
- A theme you set **holds** until Steven says otherwise — use action `auto` to hand
  control back to the automatic time-of-day schedule.
- Use action `scene` only when he names morning / day / evening / night.
- `on` / `off` toggle power; `flash` is a quick notification pulse; `enable` /
  `disable` turn the whole system on or off; `tune` adjusts taste (per-light
  brightness, exclude a light, avoid red).

Lighting is low-stakes and reversible — just do it and say what you set; no need to
confirm first.
