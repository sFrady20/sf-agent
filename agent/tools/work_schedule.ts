import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";
import { workDayInfo } from "../lib/work-schedule.js";

// Reads the configured weekly schedule plus the computed work status for a given
// day (default today) — for questions like "am I in the office tomorrow?".
export default defineTool({
  description:
    "Read Steven's work schedule: the configured weekly pattern and standing meetings, plus whether a given date is a workday, where, and which meetings fall on it. Defaults to today. Use for questions about his work days, hours, or whether he's working/in-office.",
  inputSchema: z.object({
    date: z.string().optional().describe("YYYY-MM-DD to check; defaults to today."),
  }),
  async execute({ date }) {
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { error: "date must be a calendar date like 2026-07-05." };
    }
    const schedule = await store.workSchedule.get();
    const day = await workDayInfo(date);
    return { configured: !!schedule, schedule, day };
  },
});
