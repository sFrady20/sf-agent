import { defineChannel, POST } from "eve/channels";
import { bearerOrQuery, secretMatches } from "../lib/auth.js";
import { triageDiscordBatch, type DiscordTriageMessage } from "../lib/discord-triage.js";
import { store } from "../lib/store/index.js";

// Autonomous Discord ingestion. The Pi worker holds a gateway WebSocket (a
// serverless function can't) and POSTs batches of server messages here; a
// cheap triage pass keeps tasks/memory in sync and pings Telegram only when
// something needs Steven. Auth: Bearer <DISCORD_INGEST_SECRET>.
// Route: POST /eve/v1/discord/ingest

export default defineChannel({
  routes: [
    POST("/eve/v1/discord/ingest", async (req, { waitUntil }) => {
      if (!secretMatches(bearerOrQuery(req, "token"), process.env.DISCORD_INGEST_SECRET)) {
        return new Response("unauthorized", { status: 401 });
      }

      let body: { batchId?: string; messages?: DiscordTriageMessage[] };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return Response.json({ ok: false, error: "bad json" }, { status: 400 });
      }
      const messages = Array.isArray(body.messages) ? body.messages : [];
      if (messages.length === 0) return Response.json({ ok: true, skipped: "empty" });

      // The worker retries failed forwards — dedup on batch id so a retry after
      // a slow-but-successful triage never double-processes.
      const batchKey = `discord:batch:${body.batchId ?? "unkeyed"}`;
      if (body.batchId && (await store.reminders.was(batchKey))) {
        return Response.json({ ok: true, skipped: "duplicate" });
      }
      if (body.batchId) await store.reminders.mark(batchKey);

      const chatId = process.env.OWNER_TELEGRAM_USER_ID;
      waitUntil(
        triageDiscordBatch(messages, chatId).catch((err) => {
          console.warn("[discord-ingest] triage failed", err);
        }),
      );

      return Response.json({ ok: true, received: messages.length });
    }),
  ],
});
