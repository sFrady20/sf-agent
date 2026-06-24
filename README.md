# sf-agent

A personal life-and-work assistant built on [eve](https://beta.eve.dev) — an
open-source showcase agent that helps with the everyday: remembering things,
recurring chores and appointments, travel and errand planning, and dev/creative
work. Reached over Discord.

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

Set up environment variables from [`.env.example`](.env.example). The agent runs
with an in-memory store until you add Vercel KV / Upstash credentials.

## How it's built

- `agent/instructions/` — who the agent is and how it behaves.
- `agent/channels/discord.ts` — the primary surface (owner-gated).
- `agent/tools/` — capture, recall, facts, and tasks (the memory tools).
- `agent/lib/store/` — the swappable durable-memory layer.
- `agent/schedules/morning_brief.ts` — a proactive daily brief.
- `evals/` — scored behavior checks.

Full design notes in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); the feature
backlog is in [docs/ROADMAP.md](docs/ROADMAP.md).

## Connecting Discord

1. Create an application in the Discord Developer Portal; copy the public key,
   application id, and a bot token into your environment.
2. Register a slash command (see `docs/ARCHITECTURE.md`).
3. Deploy, then paste the deployment's `/eve/v1/discord` URL into the app's
   Interactions Endpoint URL.

## Learn more

- [Eve documentation](https://beta.eve.dev/docs/introduction)
- Bundled framework guides: `node_modules/eve/docs/`
