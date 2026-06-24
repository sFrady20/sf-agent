# sf-agent

A personal life-and-work assistant built on [eve](https://beta.eve.dev) — an
open-source showcase agent that helps with the everyday: remembering things,
recurring chores and appointments, travel and errand planning, and dev/creative
work. Reached over Telegram (free-text chat) and Discord (slash commands).

## Getting started

```bash
bun install

# Link the project and pull env vars (or copy .env.example to .env.local)
vercel link
vercel env pull

bun run dev          # start the dev server
bun run typecheck    # type-check the app
bun run eval         # run the behavior evals
```

Set up environment variables from [`.env.example`](.env.example). **On Vercel you
must provision Vercel KV / Upstash** and set `KV_REST_API_URL` / `KV_REST_API_TOKEN` —
the in-memory fallback does not persist across serverless invocations, so the
agent would forget between messages without it.

## How it's built

- `agent/instructions/` — who the agent is and how it behaves.
- `agent/channels/` — Telegram (chat), Discord (slash commands), eve (HTTP).
- `agent/tools/` — capture, recall, facts, tasks, and Google Calendar.
- `agent/lib/store/` — the swappable durable-memory layer.
- `agent/lib/google.ts` — service-account Google Calendar access.
- `agent/schedules/morning_brief.ts` — a proactive daily brief to Telegram.
- `evals/` — scored behavior checks.

Full design notes in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); the feature
backlog is in [docs/ROADMAP.md](docs/ROADMAP.md).

## Connecting the channels

**Telegram (chat).** Create a bot with @BotFather, set `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET_TOKEN`, and
`OWNER_TELEGRAM_USER_ID`, then register the webhook against your deployment:

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

## Learn more

- [Eve documentation](https://beta.eve.dev/docs/introduction)
- Bundled framework guides: `node_modules/eve/docs/`
