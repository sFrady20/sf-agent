# Roadmap & idea backlog

The captured backlog for sf-agent — Steven's personal life-and-work assistant.
Organized by domain, then by build phase. Nothing here is committed scope; it's
the menu we pull from.

Legend: ✅ scaffolded · 🔜 next · 💡 idea

---

## 🏠 Household & family ops

The core pain: planning appointments, recurring chores, and remembering things.

- ✅ Quick-capture inbox (`capture`) — text it a thought, it files it.
- ✅ Recurring chores + tasks (`add_task` / `list_tasks`) with cadence + due dates.
- ✅ Google Calendar read/write/delete (`list_calendar_events` /
  `create_calendar_event` / `delete_calendar_event`) via a service account
  (writes and deletes are approval-gated).
- ✅ Recurring-chore reminders: rollover on completion (`complete_task`) plus
  due/overdue nudges via the reminder endpoint (GitHub Actions cron).
- ✅ Appointment reminders: near-time nudges (reminder endpoint) + day-ahead in the
  evening review.
- ✅ New-baby prep pack (`new_baby` skill): hospital bag, home setup, paperwork
  and leave logistics, big-sister adjustment — anchored to the due date, high
  stakes on real deadlines.
- ✅ Parking-spot camera (`check_parking` / `watch_parking`): the Pi grabs Wyze
  frames via docker-wyze-bridge, a cheap vision model counts open spots, and a
  timed watch pings Telegram when one opens.
- 💡 Predictive supply reminders (diapers, formula, wipes) from consumption cadence.
- 💡 Meal planning + grocery list generation.
- 💡 Birthday/gift reminders for family.
- 💡 Shared coordination with wife (her own Discord access or a shared channel).

## 🧠 Second brain / memory

The "remembering things throughout the day" problem.

- ✅ Durable profile facts (`remember_fact`) — doctors, sizes, time zone, accounts.
- ✅ Cross-store search (`recall`).
- ✅ Daily review via the morning brief; the evening review folds in open tasks
  and the inbox.
- ✅ Ranked multi-term recall: query words match independently across notes,
  facts, and tasks; results sorted by relevance.
- 💡 Richer retrieval still open: embeddings / semantic search.

## 📧 Email (Gmail)

- ✅ Read / search / triage / send (`search_email` / `read_email` / `modify_email`
  / `send_email`; send is approval-gated). OAuth refresh token.
- ✅ Auto-tracking from the inbox: Gmail → Pub/Sub → `gmail` channel → free
  spam/bulk filter → a cheap model extracts tasks + facts into memory. No
  per-email pings. Watch renewed daily by GitHub Actions.
- ✅ Human-only alerts: a Telegram ping fires only when a real person is trying
  to reach Steven or a deadline would hurt to miss — automated mail (2FA
  "was this you", receipts, newsletters) never pings. Actions triage takes
  (tasks/facts/reminders/closes) are reported in one compact message.
- ✅ Standing triage rules: the `email_triage_rules` fact (set conversationally)
  feeds every triage call; triage also sets task stakes and reads HTML-only mail.
- ✅ Inbox recall memory: every non-spam email is logged (sender, subject,
  snippet — no model, no bodies) to the surface-generic `activity` store, capped
  + TTL'd, searchable via `recall` — "did I get that email from GEICO?" works
  even when triage skipped it. New surfaces reuse the same store.
- 💡 On-demand thread summaries.

## 💬 Discord

- ✅ Slash-command surface (owner-gated) for commands + approvals.
- ✅ Autonomous message ingestion: the Pi worker holds a gateway WebSocket
  (Message Content intent), batches server messages/DMs, and forwards them to
  `POST /eve/v1/discord/ingest`; a cheap triage pass (like email) records
  tasks/facts/reminders and pings Telegram only when a real person needs Steven.
  Standing rules via the `discord_triage_rules` fact.
- ✅ Action-report pings: every triage that does something tells Steven what it
  did (one compact Telegram message) — the agent reports its own actions, not
  the news. Automated content (2FA-style alerts, bots) never notifies.
- ✅ Conversation memory: rolling per-channel digests (capped + TTL'd) readable
  via `discord_recap` and searchable via `recall` — "what were people talking
  about in #gamedev, and where?" without storing transcripts.
- 💡 Replying on Discord from the triage path (currently reply-needed → task).

## ✈️ Travel

- ✅ Trip planning skill (`plan_a_trip`) — weather-aware via real forecasts
  (`get_weather`, Open-Meteo, no key).
- ✅ Family-aware travel planning (`plan_a_trip` skill): gentle pacing, naps, car
  seats, kid packing lists, optional prep tasks + calendar.
- 💡 Flight/hotel research, check-in and document reminders.

## 💻 Dev & freelance

- ✅ GitHub project board: the agent controls a copy of your board (`list_work` /
  `add_work_item` / `set_work_status`); the original stays untouched. Token-frugal
  authored GraphQL tools, not an MCP.
- ✅ Day-job work schedule (`set_work_schedule` / `set_work_day` / `work_schedule`):
  structured, swappable work rhythm — workdays, hours, in-office/remote, standing
  meetings, plus dated overrides (PTO/WFH). The briefs read it instead of guessing
  (no more "rest day" on a workday). Deadlines reuse high-stakes tasks. Job-agnostic
  so a new job is a data reset, not a rewrite. (Profile/links + EOD review later.)
- 💡 GitHub channel — @mention the agent on PRs/issues; review with checkout.
- 💡 Linear channel for project delegation.
- ✅ Freelance ops (`freelance` skill): client intake, milestones, recurring
  invoice reminders, project status. (Time-tracking + deploy monitoring later.)

## 🎛️ DJ / electronic music

- ✅ Set planning + harmonic mixing (`dj_set` skill + `harmonic_matches` tool);
  crate ideas via capture.
- 💡 New-release monitoring for labels/artists → scheduled digest.
- ✅ Gig logistics + promo reminders via the `dj_set` skill (tasks).

## 🎮 Game dev

- ✅ Devlog/idea capture, backlog, playtest feedback, scope discipline
  (`gamedev` skill).

## 🔔 Proactive layer

- ✅ Morning brief schedule (`morning_brief`) — delivers to Telegram; folds in
  calendar + tasks + inbox.
- ✅ Evening review schedule (`evening_review`) — open/overdue tasks + inbox +
  a tomorrow nudge.
- ✅ Short-fuse timed reminders ("remind me in 55 min") via the always-on home
  Pi worker (`remind_me` → sf-pi-worker over Tailscale Funnel), with
  `list_reminders` / `cancel_reminder` to review and cancel what's pending.
- 💡 Weekly planning sweep.

---

## Build phases

- **Phase 0 — Foundation** ✅ *(this scaffold)*
  Telegram (chat) + Discord (slash) channels, swappable storage layer + memory
  tools, service-account Calendar tools, instructions, model bump, locked-down
  HTTP route, evals harness, docs.
- **Phase 1 — Capture & recall** ✅
  Full memory CRUD (capture / list_inbox / delete_note, list_facts, complete_task
  with recurring rollover), morning + evening proactive schedules, more evals.
  Provision Vercel KV to make persistence durable.
- **Phase 2 — Calendar & chores** ✅
  Reminder engine (`lib/reminders.ts`): deduped, quiet-hours-gated nudges for
  due/overdue chores and upcoming appointments, exposed at `POST /eve/v1/cron/
  reminders` (`cron` channel) and driven by a free GitHub Actions cron every 30
  min — so near-time reminders work on Vercel Hobby. Evening review includes the
  day-ahead. Google Tasks still needs OAuth.
- **Phase 3 — Domain packs** ✅
  Travel rewritten family-aware; `dj_set` (+ `harmonic_matches` tool), `freelance`,
  and `gamedev` skills added. Packs are skills for now and can graduate to
  subagents if they need their own tools. (GitHub/Linear channels and new-release
  monitoring still open.)
- **Phase 4 — Showcase polish** ✅
  Broader eval suite (deterministic + LLM-judge), GitHub Actions CI (typecheck),
  observability documented (Vercel Agent Runs + OTel hook), MIT license, and a
  showcase README. Live OTel export left as a ready-to-paste hook.

## Conventions for adding to this backlog

- A new optional procedure → a **skill** (`agent/skills/`).
- A new typed action → a **tool** (`agent/tools/`).
- A new external service → a **connection** (`agent/connections/`).
- A new specialist role → a **subagent** (`agent/subagents/`).
- A new proactive cadence → a **schedule** (`agent/schedules/`).

See [ARCHITECTURE.md](./ARCHITECTURE.md) for how each slot works.
