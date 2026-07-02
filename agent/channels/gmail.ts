import { defineChannel, POST } from "eve/channels";
import { bearerOrQuery, secretMatches } from "../lib/auth.js";
import { triageEmail } from "../lib/email-triage.js";
import { GmailHistoryExpired, getMessageForTriage, newInboxHistory, startWatch, type TriageMessage } from "../lib/gmail.js";
import { store } from "../lib/store/index.js";

// Real-time Gmail processing. Gmail → Pub/Sub → POST /eve/v1/gmail/push. New mail
// is pre-filtered cheaply (no model), then a cheap model quietly extracts tasks +
// facts into memory and pings Telegram ONLY when something is time-sensitive.
// (You see the email arrive normally; the agent just keeps track.) A daily
// external cron hits /eve/v1/gmail/watch to renew the watch (expires after 7d).
//
// Auth: a shared secret, `Authorization: Bearer <GMAIL_PUSH_SECRET>` or
// ?token=<GMAIL_PUSH_SECRET> (Pub/Sub push can't set headers).

const HISTORY_KEY = "gmail:lastHistoryId";

// Free spam/bulk barrier before any model call: skip Gmail's bulk categories and
// mailing-list mail. Only "real" mail reaches the model.
const SKIP_LABELS = new Set([
  "CATEGORY_PROMOTIONS",
  "CATEGORY_SOCIAL",
  "CATEGORY_UPDATES",
  "CATEGORY_FORUMS",
  "SPAM",
  "TRASH",
]);

function worthProcessing(msg: TriageMessage): boolean {
  if (msg.bulk) return false;
  return !msg.labelIds.some((l) => SKIP_LABELS.has(l));
}

function authorized(req: Request): boolean {
  return secretMatches(bearerOrQuery(req, "token"), process.env.GMAIL_PUSH_SECRET);
}

export default defineChannel({
  routes: [
    POST("/eve/v1/gmail/push", async (req, { waitUntil }) => {
      if (!authorized(req)) return new Response("unauthorized", { status: 401 });
      const chatId = process.env.OWNER_TELEGRAM_USER_ID;

      // Pub/Sub envelope: { message: { data: base64(JSON{ emailAddress, historyId }) } }
      let pushedHistoryId: string | undefined;
      try {
        const body = (await req.json()) as { message?: { data?: string } };
        if (body.message?.data) {
          const decoded = JSON.parse(Buffer.from(body.message.data, "base64").toString("utf8")) as {
            historyId?: string | number;
          };
          if (decoded.historyId != null) pushedHistoryId = String(decoded.historyId);
        }
      } catch {
        // malformed payload — still ack so Pub/Sub doesn't hammer us
      }

      waitUntil(
        (async () => {
          try {
            const last = await store.kv.get(HISTORY_KEY);
            if (!last) {
              // First push just sets the baseline.
              if (pushedHistoryId) await store.kv.set(HISTORY_KEY, pushedHistoryId);
              return;
            }

            let ids: string[];
            let nextBaseline: string | undefined;
            try {
              ({ ids, historyId: nextBaseline } = await newInboxHistory(last));
            } catch (err) {
              if (err instanceof GmailHistoryExpired) {
                // The stored baseline aged out (Gmail keeps ~a week). The gap is
                // unrecoverable — reset so future pushes work again.
                if (pushedHistoryId) await store.kv.set(HISTORY_KEY, pushedHistoryId);
                console.warn("[gmail] history baseline expired — reset; some messages were skipped");
                return;
              }
              throw err; // transient — keep the baseline so the next push retries
            }

            for (const id of ids) {
              if (await store.reminders.was(`email:${id}`)) continue;
              await store.reminders.mark(`email:${id}`);
              try {
                const msg = await getMessageForTriage(id);
                if (!worthProcessing(msg)) continue; // free spam/bulk barrier
                await triageEmail(msg, chatId); // cheap model: update tasks/memory; ping if urgent
              } catch (err) {
                console.warn("[gmail] triage failed", id, err);
              }
            }

            // Advance only after a successful sweep. If we die mid-loop, the next
            // push replays from the old baseline; per-message marks keep it cheap.
            const baseline = nextBaseline ?? pushedHistoryId;
            if (baseline) await store.kv.set(HISTORY_KEY, baseline);
          } catch (err) {
            console.warn("[gmail push] failed", err);
          }
        })(),
      );

      return new Response("ok"); // ack Pub/Sub promptly
    }),

    POST("/eve/v1/gmail/watch", async (req) => {
      if (!authorized(req)) return new Response("unauthorized", { status: 401 });
      try {
        const { historyId, expiration } = await startWatch();
        await store.kv.set(HISTORY_KEY, String(historyId));
        return Response.json({ ok: true, expiration });
      } catch (e) {
        return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
      }
    }),
  ],
});
