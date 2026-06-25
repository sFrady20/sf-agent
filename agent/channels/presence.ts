import { defineChannel, POST } from "eve/channels";
import { store } from "../lib/store/index.js";

// The Pi worker POSTs here when Steven's phone joins/leaves home WiFi. We just
// record it as a fact (no model turn, zero tokens) so the agent knows whether
// he's home — readable via recall / list_facts.
export default defineChannel({
  routes: [
    POST("/eve/v1/presence", async (req) => {
      const secret = process.env.PRESENCE_SECRET;
      const provided =
        new URL(req.url).searchParams.get("token") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
      if (!secret || provided !== secret) return new Response("unauthorized", { status: 401 });

      const body = (await req.json()) as { state?: string; at?: string };
      if (body.state === "home" || body.state === "away") {
        await store.facts.set("home_status", `${body.state} (as of ${body.at ?? new Date().toISOString()})`);
      }
      return Response.json({ ok: true });
    }),
  ],
});
