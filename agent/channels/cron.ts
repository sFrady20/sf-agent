import { defineChannel, POST } from "eve/channels";
import { collectReminders, reminderMessage } from "../lib/reminders.js";
import { reconcileTasks } from "../lib/task-reconcile.js";
import telegram from "./telegram.js";

// Secret-protected trigger for the reminder sweep. A free external scheduler
// (see .github/workflows/reminders.yml) POSTs here on a cadence, which sidesteps
// Vercel Hobby's daily-cron limit and gives near-time reminders. Auth is a shared
// secret sent as `Authorization: Bearer <CRON_SECRET>` (or `?secret=`).

const APP_AUTH = {
  authenticator: "app",
  principalId: "eve:app",
  principalType: "runtime",
  attributes: {},
} as const;

export default defineChannel({
  routes: [
    POST("/eve/v1/cron/reminders", async (req, { receive, waitUntil }) => {
      const secret = process.env.CRON_SECRET;
      const provided =
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
        new URL(req.url).searchParams.get("secret");
      if (!secret || provided !== secret) {
        return new Response("unauthorized", { status: 401 });
      }

      // Assume-done pass first: decay low-stakes overdue, roll recurring forward —
      // so the reminders below only surface what's genuinely still pending.
      try {
        await reconcileTasks();
      } catch (e) {
        console.warn("[cron] task reconcile failed", e);
      }

      const result = await collectReminders();
      if (!result) return Response.json({ ok: true, delivered: false });

      waitUntil(
        receive(telegram, {
          message: reminderMessage(result.lines),
          target: { chatId: result.chatId },
          auth: APP_AUTH,
        }),
      );
      return Response.json({ ok: true, delivered: true, reminders: result.lines.length });
    }),
  ],
});
