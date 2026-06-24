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
- 🔜 Recurring-chore engine: turn `recur` into real reminders (trash day, HVAC
  filter, car maintenance, water filters, plants) via schedules.
- 🔜 Appointment tracking + reminders: pediatrician, dentist, and OB/prenatal
  appointments (timely with the second baby coming).
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
- 🔜 Daily review: "what did I say I'd do?" surfaced each morning.
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

- ✅ Morning brief schedule (`morning_brief`) — delivers to Discord.
- 🔜 Evening review (what got done, tomorrow's prep).
- 💡 Weekly planning sweep.

---

## Build phases

- **Phase 0 — Foundation** ✅ *(this scaffold)*
  Discord channel, swappable storage layer + memory tools, instructions, model
  bump, locked-down HTTP route, evals harness, docs.
- **Phase 1 — Capture & recall** 🔜
  Harden the inbox/facts/tasks flow; wire the durable KV; ship the daily brief
  and evening review.
- **Phase 2 — Calendar & tasks**
  Activate the Google Calendar/Tasks connection; recurring-chore engine;
  appointment reminders with human-in-the-loop approval.
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
