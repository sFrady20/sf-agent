// Background task reconciliation — the "you never have to mark things done" pass.
// Runs from the cron endpoint each sweep:
//   - recurring chores roll forward past their due date (the cycle is assumed run)
//   - low-stakes one-offs are silently assumed done once past due + a grace window
//   - high-stakes tasks are left open so they keep surfacing until handled
// Everything is recoverable (reopen_task).

import { currentTimezone } from "./location.js";
import { nextDueAfter } from "./recurrence.js";
import { store } from "./store/index.js";
import { dateInTz } from "./time.js";

const GRACE_DAYS = Number(process.env.TASK_GRACE_DAYS ?? 1);
const DONE_RETENTION_DAYS = Number(process.env.TASK_DONE_RETENTION_DAYS ?? 90);

const daysOverdue = (due: string, today: string) =>
  Math.round((Date.parse(today) - Date.parse(due)) / 86_400_000);

export async function reconcileTasks(): Promise<{ assumed: number; rolled: number; pruned: number }> {
  const today = dateInTz(await currentTimezone());
  let assumed = 0;
  let rolled = 0;

  for (const t of await store.tasks.list()) {
    if (!t.due || daysOverdue(t.due, today) <= 0) continue;

    if (t.recur) {
      const due = nextDueAfter(t.due, t.recur, today);
      if (due && due !== t.due) {
        const task = await store.tasks.get(t.id);
        if (task) {
          task.due = due;
          task.lastCompletedAt = new Date().toISOString();
          await store.tasks.save(task);
          rolled++;
        }
      }
      continue;
    }

    if ((t.stakes ?? "low") === "low" && daysOverdue(t.due, today) > GRACE_DAYS) {
      await store.tasks.close(t.id, "assumed");
      assumed++;
    }
  }

  const pruned = await store.tasks.pruneCompleted(DONE_RETENTION_DAYS);
  return { assumed, rolled, pruned };
}
