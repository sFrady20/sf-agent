# Architecture

sf-agent is built on [eve](https://beta.eve.dev), a filesystem-first agent
framework: capability comes from which folder a file lands in. This doc is the
map. For the framework's own guides, read `node_modules/eve/docs/`.

## The shape

```
agent/
  agent.ts              Runtime config (model = claude-sonnet-4.6).
  instructions/         Always-on system prompt, composed alphabetically.
    00-identity.md        Who the agent is, who Steven is.
    10-behavior.md        Operating rules (proactive capture, confirm side effects).
    20-memory.md          How to use the memory tools.
    30-calendar.md        How to use the calendar tools.
  channels/             How you reach the agent.
    telegram.ts           Conversational chat (continuous, free-text).
    discord.ts            Slash commands + the bot's presence (owner-gated).
    eve.ts                Default HTTP API, locked to localDev + vercelOidc.
  tools/                Typed actions the model can call.
    capture.ts            Quick-capture inbox.
    recall.ts             Search notes + facts + tasks.
    remember_fact.ts      Save/update durable profile facts.
    add_task.ts           Add a task or recurring chore.
    list_tasks.ts         List open/all tasks.
    list_calendar_events.ts    Read Google Calendar.
    create_calendar_event.ts   Write to Google Calendar (approval-gated).
    get_weather.ts        Demo tool used by the trip skill.
  skills/               On-demand procedures (loaded when relevant).
    plan_a_trip.md
  schedules/            Proactive cron jobs.
    morning_brief.ts      Daily brief delivered to Telegram.
  subagents/            Specialist child agents.
    planner/              Example: decompose a fuzzy goal into a plan.
  lib/                  Shared, import-only code (never enters the sandbox).
    store/                The durable-memory backbone (see below).
    google.ts             Service-account Calendar access (JWT, zero-dep).
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

- **Telegram** verifies the `X-Telegram-Bot-Api-Secret-Token` header, and
  `onMessage` drops anything not from `OWNER_TELEGRAM_USER_ID`.
- **Discord** verifies Ed25519 signatures on every interaction, and
  `onCommand` drops anything not from `OWNER_DISCORD_USER_ID`.
- **eve HTTP channel** is restricted to `localDev()` + `vercelOidc()` — reachable
  from your own CLI and trusted Vercel deployments, not the public web. Add real
  auth before exposing a browser UI.
- **Side-effecting actions** (sending, booking, buying) are gated with
  human-in-the-loop approval — `needsApproval` from `eve/tools/approval`, as on
  `create_calendar_event`. The instructions also tell the model to confirm first.
- Secrets stay server-side: the Google service-account key and any connection
  credentials live in tools/env and never reach the model.

## Environment

See `.env.example`. Pull deployed values with `vercel env pull`.

| Var | Purpose |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET_TOKEN` / `TELEGRAM_BOT_USERNAME` | Telegram channel |
| `OWNER_TELEGRAM_USER_ID` | Restrict the agent to you; also the brief's target |
| `DISCORD_PUBLIC_KEY` / `DISCORD_APPLICATION_ID` / `DISCORD_BOT_TOKEN` | Discord channel |
| `OWNER_DISCORD_USER_ID` | Restrict Discord commands to you |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Durable store (optional) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Google service account |
| `GOOGLE_CALENDAR_ID` | Calendar to read/write (your email address) |

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

**Google Calendar (service account)** — wired via `lib/google.ts` and the
`list_calendar_events` / `create_calendar_event` tools. No per-user OAuth: a
service account signs a JWT locally (zero-dep, Node crypto) and exchanges it for
an access token. To set it up:

1. In Google Cloud (project with the Calendar API enabled), create a **service
   account** and download a JSON key.
2. In Google Calendar → your calendar's *Settings and sharing* → **Share with
   specific people** → add the service account's email with "Make changes to
   events".
3. Set `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (the
   PEM, newlines escaped as `\n`), and `GOOGLE_CALENDAR_ID` (your email address —
   not `primary`, which is the service account's own empty calendar).

A service account can't reach Google **Tasks** on a personal Gmail (no sharing,
no domain-wide delegation), so Tasks would need the OAuth refresh-token route.
The agent's own `add_task` / `list_tasks` cover to-dos in the meantime.

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
