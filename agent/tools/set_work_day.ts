import { defineTool } from "eve/tools";
import { z } from "zod";
import { currentTimezone } from "../lib/location.js";
import { store } from "../lib/store/index.js";
import { dateInTz } from "../lib/time.js";

// A one-off override on a specific date that beats the weekly pattern — PTO, a
// holiday, WFH today, or having to go in on a normal day off. Omit `kind` to
// clear an override. Past overrides are pruned automatically.
export default defineTool({
  description:
    "Override Steven's work status for a specific date: 'off' (PTO/holiday), 'office' or 'remote' (working, location set), or 'custom' (working, see note). Omit `kind` to clear an existing override for that date. Use this for one-offs; set_work_schedule sets the recurring weekly pattern.",
  inputSchema: z.object({
    date: z.string().describe("YYYY-MM-DD"),
    kind: z
      .enum(["off", "office", "remote", "custom"])
      .optional()
      .describe("Omit to clear any override on this date."),
    note: z.string().optional().describe("e.g. 'PTO', 'Holiday', 'leaving early'."),
  }),
  async execute({ date, kind, note }) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { error: "date must be a calendar date like 2026-07-05." };
    }
    const today = dateInTz(await currentTimezone());
    const existing = (await store.workSchedule.get()) ?? { days: {}, meetings: [], exceptions: [] };

    // Drop past overrides and any prior one for this date, then add the new one.
    const exceptions = existing.exceptions.filter((e) => e.date >= today && e.date !== date);
    if (kind) exceptions.push({ date, kind, note });

    await store.workSchedule.set({ ...existing, exceptions });
    return kind ? { set: { date, kind, note } } : { cleared: date };
  },
});
