import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";
import type { WorkDayPattern, Weekday } from "../lib/store/types.js";
import { WEEKDAYS } from "../lib/store/types.js";

// Sets Steven's recurring work rhythm so the morning/evening briefs know when he
// works, where, and what standing meetings he has. Job-agnostic and swappable —
// resending replaces the weekly pattern; one-off changes use set_work_day.
export default defineTool({
  description:
    "Set Steven's weekly work schedule: which days he works, hours, in-office vs remote, and standing meetings (e.g. standup). The agent uses this as background context (it does not announce his work status — he knows it). Resend to update. For a one-off change (PTO, WFH today), use set_work_day instead.",
  inputSchema: z.object({
    days: z
      .array(
        z.object({
          day: z.enum(WEEKDAYS),
          start: z.string().optional().describe("e.g. '09:00'"),
          end: z.string().optional().describe("e.g. '17:00'"),
          location: z.enum(["office", "remote"]).optional(),
        }),
      )
      .optional()
      .describe("One entry per working day; omit days he doesn't work. Omit the field entirely to leave the weekly days unchanged."),
    meetings: z
      .array(
        z.object({
          title: z.string().min(1),
          days: z.array(z.enum(WEEKDAYS)).min(1),
          start: z.string().describe("e.g. '09:30'"),
          end: z.string().optional(),
          location: z.string().optional(),
        }),
      )
      .optional()
      .describe("Standing recurring meetings, e.g. daily standup. Omit to leave unchanged."),
  }),
  async execute({ days, meetings }) {
    const existing = await store.workSchedule.get();

    const dayMap: Partial<Record<Weekday, WorkDayPattern>> = days
      ? Object.fromEntries(
          days.map((d) => [d.day, { start: d.start, end: d.end, location: d.location }]),
        )
      : (existing?.days ?? {});

    const saved = await store.workSchedule.set({
      days: dayMap,
      meetings: meetings ?? existing?.meetings ?? [],
      exceptions: existing?.exceptions ?? [],
    });
    return { saved };
  },
});
