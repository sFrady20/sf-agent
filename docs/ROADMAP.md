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
- ✅ Google Calendar read/write (`list_calendar_events` / `create_calendar_event`)
  via a service account (writes are approval-gated).
- ✅ Recurring-chore reminders: rollover on completion (`complete_task`) plus
  scheduled due/overdue nudges via `reminder_sweep`.
- ✅ Appointment reminders: near-time nudges (`reminder_sweep`) + day-ahead in the
  evening review.
- 💡 New-baby prep pack: hospital-bag checklist, registry gaps, name shortlist,
  big-sister adjustment ideas, leave/logistics planning.
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
- 💡 Note/link/idea capture with richer retrieval (tags, full-text, embeddings).

## ✈️ Travel

- ✅ Trip planning skill (`plan_a_trip`) — seeded, weather-aware.
- 🔜 Family-aware planning: nap schedules, car seats, kid-friendly itineraries,
  packing lists scaled to "toddler + newborn".
- 💡 Flight/hotel research, check-in and document reminders.

## 💻 Dev & freelance

- 💡 GitHub channel — @mention the agent on PRs/issues; review with checkout.
- 💡 Linear channel for project delegation.
- 💡 Freelance ops: client intake, invoice/payment reminders, time-tracking
  nudges, weekly project-status digest, deploy monitoring.

## 🎛️ DJ / electronic music

- 💡 Crate & set management; harmonic-mixing (key/BPM) suggestions; setlist archive.
- 💡 New-release monitoring for labels/artists → scheduled digest.
- 💡 Gig logistics + promo/post reminders.

## 🎮 Game dev

- 💡 Devlog capture, idea backlog, playtest-feedback intake, asset/task tracking.

## 🔔 Proactive layer

- ✅ Morning brief schedule (`morning_brief`) — delivers to Telegram; folds in
  calendar + tasks + inbox.
- ✅ Evening review schedule (`evening_review`) — open/overdue tasks + inbox +
  a tomorrow nudge.
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
  Reminder engine (`reminder_sweep`): deduped, quiet-hours-gated nudges for
  due/overdue chores and upcoming appointments; evening review now includes the
  day-ahead. Frequency depends on Vercel plan. Google Tasks still needs OAuth.
- **Phase 3 — Domain packs**
  Extend travel; add DJ / dev / freelance / gamedev as skills + subagents.
- **Phase 4 — Showcase polish**
  Broader evals, instrumentation, architecture docs, public README.

## Conventions for adding to this backlog

- A new optional procedure → a **skill** (`agent/skills/`).
- A new typed action → a **tool** (`agent/tools/`).
- A new external service → a **connection** (`agent/connections/`).
- A new specialist role → a **subagent** (`agent/subagents/`).
- A new proactive cadence → a **schedule** (`agent/schedules/`).

See [ARCHITECTURE.md](./ARCHITECTURE.md) for how each slot works.
