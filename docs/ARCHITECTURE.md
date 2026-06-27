# Architecture

sf-agent is built on [eve](https://beta.eve.dev), a filesystem-first agent
framework: capability comes from which folder a file lands in. This doc is the
map. For the framework's own guides, read `node_modules/eve/docs/`.

## The shape

```
agent/
  agent.ts              Runtime config (model = claude-sonnet-4.6).
  instructions/         Always-on system prompt, composed alphabetically.
    00-identity.md        Who the agent is ("Computer"), who Steven is.
    05-voice.md           Tone & persona (sincere + authoritative/ironic, dense, no snark/corny).
    10-behavior.md        Operating rules (proactive capture, confirm side effects).
    20-memory.md          How to use the memory tools.
    30-calendar.md        How to use the calendar tools.
  channels/             How you reach the agent.
    telegram.ts           Conversational chat + inbound images (vision).
    discord.ts            Slash commands + the bot's presence (owner-gated).
    eve.ts                Default HTTP API, locked to localDev + vercelOidc.
    cron.ts               Secret-protected reminder trigger (external cron).
    gmail.ts              Gmail push (Pub/Sub) + watch-renew endpoints.
    presence.ts           Home/away updates from the Pi (records a fact).
  tools/                Typed actions the model can call.
    capture.ts            Quick-capture inbox.
    list_inbox.ts         List inbox notes with ids.
    delete_note.ts        Remove a handled note.
    current_time.ts       Authoritative local time (host clock + DST-aware offset).
    recall.ts             Search notes + facts + tasks.
    remember_fact.ts      Save/update durable profile facts.
    list_facts.ts         List all profile facts.
    add_task.ts           Add a task or recurring chore.
    list_tasks.ts         List open/all tasks.
    complete_task.ts      Finish a task; recurring chores roll forward.
    list_calendar_events.ts    Read Google Calendar.
    create_calendar_event.ts   Write to Google Calendar (approval-gated).
    harmonic_matches.ts   Camelot-wheel compatible keys (DJ).
    list_work.ts          List work from the GitHub board.
    add_work_item.ts      Add a card to the GitHub board.
    set_work_status.ts    Move a card on the GitHub board.
    search_email.ts       Search Gmail.
    read_email.ts         Read one email's body.
    send_email.ts         Send email (approval-gated).
    modify_email.ts       Archive / mark read / unread.
    remind_me.ts          Delayed reminder via the home Pi worker.
    remind_when.ts        Reminder on getting home / leaving (presence).
    lights.ts             Control home-lab LIFX lighting (via the Pi).
    get_weather.ts        Demo tool used by the trip skill.
  skills/               On-demand procedures (loaded when relevant).
    plan_a_trip.md        Family-aware travel planning.
    dj_set.md             DJ sets, harmonic mixing, crate.
    freelance.md          Client/project ops.
    gamedev.md            Devlog, backlog, playtests.
    work.md               GitHub board: status + tracking.
    gmail.md              Email: read, search, triage, send.
    lighting.md           Home-lab lighting themes + tuning.
  schedules/            Proactive cron jobs (2 — Hobby-safe).
    morning_brief.ts      Morning brief delivered to Telegram.
    evening_review.ts     Evening review + day-ahead, to Telegram.
  subagents/            Specialist child agents.
    planner/              Example: decompose a fuzzy goal into a plan.
  lib/                  Shared, import-only code (never enters the sandbox).
    store/                The durable-memory backbone (see below).
    recurrence.ts         Next-due computation for recurring chores.
    time.ts               Time-zone helpers (local "today", quiet hours).
    reminders.ts          Reminder selection + dedup (used by the cron channel).
    google.ts             Service-account Calendar access (JWT, zero-dep).
    gmail.ts              Gmail via OAuth refresh token (read/send/manage/watch).
    email-triage.ts       Cheap model decides per email: notify / tasks / facts / reminders.
    github.ts             Projects v2 GraphQL (one board, zero-dep).
    telegram.ts           Direct Bot API send (zero-token pings).
    remote.ts             Dispatch jobs to the home Pi worker.
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
  (zero extra dependencies, just `fetch`); otherwise an in-memory map that does
  **not** persist across restarts — and on Vercel's serverless runtime it won't
  survive between invocations, so configure KV before relying on memory there.
- `repositories.ts` — typed repos (`notes`, `facts`, `tasks`, `reminders`) that
  own their key prefixes and JSON serialization.
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
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Durable store (required on Vercel) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Google service account |
| `GOOGLE_CALENDAR_ID` | Calendar to read/write (your email address) |
| `OWNER_TIMEZONE` | Local tz for reminder "today" + quiet hours |
| `APPOINTMENT_LEAD_MIN` | Minutes before an event to nudge (default 60) |
| `CRON_SECRET` | Bearer secret for `POST /eve/v1/cron/reminders` |
| `GITHUB_TOKEN` | PAT with Projects read/write |
| `GITHUB_PROJECT_ID` | The agent's board (a copy of your real board) — node id |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` / `_REFRESH_TOKEN` | Gmail (OAuth user token) |
| `GMAIL_PUBSUB_TOPIC` | Pub/Sub topic for `users.watch` |
| `GMAIL_PUSH_SECRET` | Guards the Gmail push + watch endpoints |
| `PI_WORKER_URL` / `PI_WORKER_SECRET` | Home Pi worker (Tailscale Funnel) for delayed jobs |
| `PRESENCE_SECRET` | Guards `POST /eve/v1/presence` (home/away from the Pi) |

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

## Proactive reminders

Two Vercel cron schedules push to Telegram daily: `morning_brief` (the day ahead)
and `evening_review` (open work + tomorrow). Near-time reminders — nudges before
appointments and when chores/tasks come due — run through the `cron` channel
instead, because Vercel's Hobby plan rejects sub-daily cron and caps the cron
count. The selection logic lives in `lib/reminders.ts` and is non-spammy by design:

- **Dedup**: each reminder is keyed (`task:<id>:<due>`, `appt:<id>:<start>`) in the
  `reminders` store and fires once. This needs KV — without it every run re-reminds.
- **Quiet hours**: it only fires 7am–10pm in `OWNER_TIMEZONE`.
- **Lead time**: appointments nudge `APPOINTMENT_LEAD_MIN` minutes ahead (default 60).

`POST /eve/v1/cron/reminders` runs a sweep when called with
`Authorization: Bearer $CRON_SECRET`. A free external scheduler hits it on a
cadence — see `.github/workflows/reminders.yml` (GitHub Actions, every 30 min);
swap in cron-job.org or Upstash QStash if you prefer. This keeps Vercel at two
cron jobs (Hobby-safe) while still giving near-time reminders.

## Domain packs

Steven's recurring contexts are packaged as on-demand **skills** rather than
always-on prompt: `plan_a_trip` (family travel), `dj_set` (sets + harmonic mixing,
backed by the `harmonic_matches` tool), `freelance` (client/project ops), and
`gamedev` (devlog + backlog). The model loads one only when a request matches its
description, so they never bloat every turn, and each leans on the shared memory
and calendar tools. A pack graduates to a subagent only if it needs its own tool
surface or a distinct role.

## Observability

Deployed on Vercel, eve tags every workflow run with `$eve.*` attributes, so the
**Agent Runs** tab traces each session → turn → tool call with token usage — no
`instrumentation.ts` required. To export AI SDK spans to an OpenTelemetry backend
(Braintrust, Datadog, Honeycomb, …), add `agent/instrumentation.ts`:

```ts title="agent/instrumentation.ts"
import { defineInstrumentation } from "eve/instrumentation";
import { registerOTel } from "@vercel/otel";

export default defineInstrumentation({
  setup: ({ agentName }) => registerOTel({ serviceName: agentName }),
});
```

It runs before agent code, so keep it minimal and install the exporter you use.
Set `recordInputs` / `recordOutputs` to `false` if spans shouldn't carry message
content.

## Quality

`evals/` holds `eve eval` checks — deterministic (`completed`, `calledTool`,
content `includes`) plus one LLM-as-judge (`closedQA`) for reply quality. The
judge routes through the AI Gateway and skips cleanly without credentials, so a
plain run never errors. `.github/workflows/ci.yml` type-checks every push and PR;
run `eve eval --strict` in CI when you want soft-threshold misses to fail too.

## GitHub project board

The agent fully controls one GitHub Projects (v2) board — a **copy** of your real
board, so the original is never touched. It reads and writes that copy:
`list_work` summarizes current work, `add_work_item` adds draft cards, and
`set_work_status` moves them (matched by title, so opaque node ids never enter the
model's context).

It's three small authored tools over the Projects GraphQL API (`lib/github.ts`),
not a GitHub MCP — a deliberately token-frugal choice, since an MCP pushes a large
tool surface into context every turn. The `work` skill loads only on demand, and
`list_work` returns just titles + status. Set `GITHUB_TOKEN` and
`GITHUB_PROJECT_ID`.

## Gmail

Gmail uses **OAuth** (a user refresh token), not the Calendar service account — a
service account can't reach a personal inbox. `lib/gmail.ts` refreshes the access
token and calls the Gmail REST API; tools are `search_email`, `read_email`,
`send_email` (approval-gated — sending is irreversible), and `modify_email`.

**Real-time processing** runs through the `gmail` channel, not polling — and it
doesn't ping per email (you already see mail arrive). It quietly keeps tasks and
memory in sync, and only pings when something is time-sensitive:

- Gmail publishes mailbox changes to a Pub/Sub topic; Pub/Sub push-delivers to
  `POST /eve/v1/gmail/push?token=<GMAIL_PUSH_SECRET>`. The push carries only a
  `historyId`, so the webhook fetches the delta and dedupes per message.
- **Free spam/bulk barrier first** (no model): skips Gmail's Promotions / Social /
  Updates / Forums / Spam categories and mailing-list mail (`List-Unsubscribe`,
  `Precedence: bulk`).
- For what's left, **one cheap structured model call** (`lib/email-triage.ts`,
  Haiku by default) **decides what to do** with the actions it has: record tasks,
  save durable facts, set a timed reminder (via the Pi worker), and/or message
  Steven on Telegram. It's conservative about interrupting (he already sees his
  email). It does not auto-reply or write to the calendar — those become tasks.
  Code applies the chosen actions; the Telegram message (no agent turn) fires only
  when the model decides to notify. It's not a full agent loop, so it stays cheap.
- `users.watch` expires after 7 days, so `POST /eve/v1/gmail/watch` renews it,
  driven daily by `.github/workflows/gmail-watch.yml` (no Vercel cron used).

Set the OAuth trio plus `GMAIL_PUBSUB_TOPIC`, `GMAIL_PUSH_SECRET`, and optionally
`EMAIL_TRIAGE_MODEL`.

## Remote compute (home worker)

Some work doesn't fit a serverless function — arbitrary-delay reminders, long-
running or interactive jobs. Those go to an always-on worker on a home Raspberry
Pi ([sf-pi-worker](https://github.com/sFrady20/sf-pi-worker)), reached over
**Tailscale Funnel** (a stable public HTTPS URL) and gated by `PI_WORKER_SECRET`.

The `remind_me` tool POSTs a job to the worker; the worker holds the timer and
pings Telegram when it fires. The job protocol is typed and extensible (today just
`reminder`), so new long-running job types are added on the worker side without
touching the agent's serverless limits.

The worker also runs a **cooperative LIFX lighting daemon** on the LAN: color-first
time-of-day scenes, gentle drift, and a taste config (per-light brightness, avoided
colors). The agent can also design a custom **theme** that holds until resumed, and
it backs off any bulb you've changed by hand until the next authoritative scene. The
`lights` tool drives and tunes it.

It also runs a **presence monitor** (`ip monitor neigh`) watching Steven's phone on
the LAN. Arrivals/departures fire `remind_when` reminders to Telegram and POST to
the agent's `presence` channel, which records a `home_status` fact the agent can read.

## Model strategy

Root runs `claude-sonnet-4.6` for planning and reasoning. Push heavy planning to
`claude-opus-4.8` and cheap, high-volume subtasks to `claude-haiku-4.5` via a
subagent. Per-agent model is set in each `agent.ts`.

## Deploy notes

- Schedules become Vercel Cron Jobs (UTC). Confirm under Settings → Cron Jobs.
- Replace the eve route auth with real auth before any public exposure.
- Run `eve eval --strict` in CI so soft-threshold misses also fail the build.
