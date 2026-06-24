# Architecture

sf-agent is built on [eve](https://beta.eve.dev), a filesystem-first agent
framework: capability comes from which folder a file lands in. This doc is the
map. For the framework's own guides, read `node_modules/eve/dist/docs/public/`
(also mirrored at `node_modules/eve/docs/`).

## The shape

```
agent/
  agent.ts              Runtime config (model = claude-sonnet-4.6).
  instructions/         Always-on system prompt, composed alphabetically.
    00-identity.md        Who the agent is, who Steven is.
    10-behavior.md        Operating rules (proactive capture, confirm side effects).
    20-memory.md          How to use the memory tools.
  channels/             How you reach the agent.
    discord.ts            Primary. Owner-gated slash commands, buttons, modals.
    eve.ts                Default HTTP API, locked to localDev + vercelOidc.
  tools/                Typed actions the model can call.
    capture.ts            Quick-capture inbox.
    recall.ts             Search notes + facts + tasks.
    remember_fact.ts      Save/update durable profile facts.
    add_task.ts           Add a task or recurring chore.
    list_tasks.ts         List open/all tasks.
    get_weather.ts        Demo tool used by the trip skill.
  skills/               On-demand procedures (loaded when relevant).
    plan_a_trip.md
  schedules/            Proactive cron jobs.
    morning_brief.ts      Daily brief delivered to Discord.
  subagents/            Specialist child agents.
    planner/              Example: decompose a fuzzy goal into a plan.
  lib/                  Shared, import-only code (never enters the sandbox).
    store/                The durable-memory backbone (see below).
evals/                  Scored behavior checks (eve eval).
docs/                   This folder.
```

The root agent's name comes from `package.json` `name` (`sf-agent`). Identity is
always path-derived — no file sets its own `name`.

## The memory backbone (`lib/store/`)

`defineState` from eve is **session-scoped** — it dies with the conversation.
Everything a personal assistant remembers (notes, facts, chores) must outlive the
session, so it lives in a small storage layer instead:

- `kv.ts` — a four-method `Kv` seam (`get/set/del/keys`). Backed by Vercel KV /
  Upstash over its REST API when `KV_REST_API_URL` + `KV_REST_API_TOKEN` are set
  (zero extra dependencies, just `fetch`); otherwise an in-memory map for local
  dev that does **not** persist across restarts.
- `repositories.ts` — typed repos (`notes`, `facts`, `tasks`) that own their key
  prefixes and JSON serialization.
- `index.ts` — assembles `store` once; import it anywhere:
  `import { store } from "../lib/store/index.js";`

Swapping to Postgres or another backend is a one-file change (`kv.ts`) — repos
and tools don't move.

## Security posture

- **Discord** verifies Ed25519 signatures on every interaction, and
  `onCommand` drops anything not from `OWNER_DISCORD_USER_ID`.
- **eve HTTP channel** is restricted to `localDev()` + `vercelOidc()` — reachable
  from your own CLI and trusted Vercel deployments, not the public web. Add real
  auth before exposing a browser UI.
- **Side-effecting actions** (sending, booking, buying) should be gated with
  human-in-the-loop approval — `needsApproval` from `eve/tools/approval` on a
  tool, or `approval` on a connection. The instructions also tell the model to
  confirm first.
- Connection credentials never reach the model; eve brokers them per step.

## Environment

See `.env.example`. Pull deployed values with `vercel env pull`.

| Var | Purpose |
| --- | --- |
| `DISCORD_PUBLIC_KEY` / `DISCORD_APPLICATION_ID` / `DISCORD_BOT_TOKEN` | Discord channel |
| `OWNER_DISCORD_USER_ID` | Restrict the agent to you |
| `OWNER_DISCORD_CHANNEL_ID` | Where the morning brief posts |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Durable store (optional) |
| `GOOGLE_MCP_URL` / `GOOGLE_MCP_TOKEN` | Google Calendar/Tasks MCP (optional) |

## Extending

**Add a tool** — drop a file in `agent/tools/`. Filename = tool name.

```ts title="agent/tools/complete_task.ts"
import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";

export default defineTool({
  description: "Mark a task or chore as done.",
  inputSchema: z.object({ id: z.string() }),
  async execute({ id }) {
    return (await store.tasks.complete(id)) ?? { error: "not found" };
  },
});
```

**Activate Google Calendar / Tasks** — create `agent/connections/google.ts`. The
connection is documented but intentionally not committed yet, so an unconfigured
MCP server can't fail at boot. Drop this in once you have an MCP endpoint:

```ts title="agent/connections/google.ts"
import { defineMcpClientConnection } from "eve/connections";
import { once } from "eve/tools/approval";

export default defineMcpClientConnection({
  url: process.env.GOOGLE_MCP_URL!,
  description: "Google Calendar and Tasks: events, reminders, to-dos.",
  auth: { getToken: async () => ({ token: process.env.GOOGLE_MCP_TOKEN! }) },
  approval: once(), // ask before the first write each session
});
```

Prefer per-user OAuth? Swap `auth` for `connect("google/sf-agent")` from
`@vercel/connect/eve` (already a dependency). The model never sees the token; it
discovers tools via `connection_search` and calls `google__<tool>`.

**Add a proactive job** — a file in `agent/schedules/`. Cron is UTC on Vercel;
`eve dev` never fires schedules (use the dispatch route in the schedule's
comment).

**Add a specialist** — a folder in `agent/subagents/<id>/` with an `agent.ts`
that exports a `description`. It inherits nothing from the root, so give it its
own tools/skills as needed.

## Model strategy

Root runs `claude-sonnet-4.6` for planning and reasoning. Push heavy planning to
`claude-opus-4.8` and cheap, high-volume subtasks to `claude-haiku-4.5` via a
subagent. Per-agent model is set in each `agent.ts`.

## Deploy notes

- Schedules become Vercel Cron Jobs (UTC). Confirm under Settings → Cron Jobs.
- Replace the eve route auth with real auth before any public exposure.
- Run `eve eval --strict` in CI so soft-threshold misses also fail the build.
