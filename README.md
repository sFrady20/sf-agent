# sf-agent

[![CI](https://github.com/sFrady20/sf-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/sFrady20/sf-agent/actions/workflows/ci.yml)

A personal life-and-work assistant built on the [eve](https://beta.eve.dev) agent
framework — and an open-source showcase of how to build a durable, multi-channel
agent. It remembers things, keeps up with chores and appointments, nudges you
proactively, and helps across travel, DJing, freelance, and game dev. You talk to
it over **Telegram** (free-text chat) and **Discord** (slash commands).

## What it does

- **Capture & recall** — text it a thought; it files it and finds it later.
- **Tasks & recurring chores** — with due dates and auto-rollover on completion.
- **Google Calendar** — read your schedule and create events (with approval).
- **Proactive** — a morning brief, an evening review, and near-time reminders
  before appointments and when chores come due.
- **Domain help** — family-aware travel planning, DJ set planning + harmonic
  mixing, freelance client ops, and game-dev backlog management.

## What it demonstrates

- **Filesystem-first agent design** on eve: tools, skills, channels, schedules,
  subagents, and a custom HTTP channel, each in its own slot.
- **A swappable storage layer** (`lib/store`) — a four-method KV seam backed by
  Upstash/Vercel KV over REST, zero extra dependencies.
- **Durable, deduped reminders** that respect quiet hours, triggered by an
  external cron to stay within Vercel Hobby limits.
- **Human-in-the-loop** approval on side-effecting actions, and owner-gated
  channels.
- **Tested behavior** — an `eve eval` suite (deterministic + LLM-as-judge) and CI.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the design and
[docs/ROADMAP.md](docs/ROADMAP.md) for the backlog.

## Tech stack

eve · TypeScript · Vercel (Functions, Cron, KV/Upstash) · Telegram & Discord ·
Google Calendar · GitHub Actions · bun.

## Getting started

```bash
bun install
vercel link && vercel env pull   # or copy .env.example to .env.local

bun run dev          # dev server
bun run typecheck    # type-check
bun run eval         # behavior evals
```

Fill in environment variables from [`.env.example`](.env.example). **On Vercel,
provision Vercel KV / Upstash** — the in-memory fallback does not persist across
serverless invocations, so the agent would forget between messages without it.
The store reads either `KV_REST_API_*` or `UPSTASH_REDIS_REST_*`.

## Connecting the channels

**Telegram (chat).** Create a bot with @BotFather, set `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET_TOKEN`, and
`OWNER_TELEGRAM_USER_ID` (your numeric id), then register the webhook:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<your-app>/eve/v1/telegram",
       "secret_token":"'"$TELEGRAM_WEBHOOK_SECRET_TOKEN"'",
       "allowed_updates":["message","callback_query"]}'
```

Then DM the bot — each private chat is one continuous conversation.

**Discord (slash commands).** Create an app in the Developer Portal, set the
Discord env vars, register an `ask` command, then point the app's Interactions
Endpoint URL at `https://<your-app>/eve/v1/discord`:

```bash
curl -X POST "https://discord.com/api/v10/applications/$DISCORD_APPLICATION_ID/commands" \
  -H "Authorization: Bot $DISCORD_BOT_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"ask","description":"Ask your agent","type":1,
    "options":[{"name":"message","description":"What do you need?","type":3,"required":true}]}'
```

**Near-time reminders** are driven by a free external cron — see
[`.github/workflows/reminders.yml`](.github/workflows/reminders.yml).

## Observability

Deployed on Vercel, the **Agent Runs** tab traces every session, turn, and tool
call automatically (no setup). To export spans to Braintrust, Datadog, or another
OpenTelemetry backend, add `agent/instrumentation.ts` — see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#observability).

## Learn more

- [Eve documentation](https://beta.eve.dev/docs/introduction)
- Bundled framework guides: `node_modules/eve/docs/`

## License

[MIT](LICENSE) © Steven Frady
