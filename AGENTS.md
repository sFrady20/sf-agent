# sf-agent

A personal life-and-work assistant for Steven, built on the
[eve](https://beta.eve.dev) framework. Reached over Discord; expandable to more
surfaces. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full map and
[docs/ROADMAP.md](docs/ROADMAP.md) for the feature backlog.

## Working in this repo

- This is an eve app: capability comes from where a file lives under `agent/`.
  Before writing code, read the relevant guide in `node_modules/eve/docs/`
  (e.g. `tools/overview.mdx`, `connections.mdx`, `schedules.mdx`).
- Package manager is **bun** (`bun install`, `bun run dev`, `bun run typecheck`).
- Module resolution is NodeNext: relative imports need the `.js` extension, and
  use `node:` builtins.
- Tool filenames are snake_case and become the model-facing tool name.
- Durable memory lives in `agent/lib/store/` — use it for anything that must
  outlive a conversation. Use `defineState` only for session-scoped working memory.
- Keep comments short; document changes in `docs/` as you go.
