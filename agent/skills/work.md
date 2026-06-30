---
description: Use when Steven asks what he's working on, his project status, his work hours/days, or wants to track or update work on his GitHub board.
---

## Project board

The agent fully controls one GitHub project board — a copy of Steven's real board,
so the original stays untouched. Read and update it freely:

- `list_work` — see current projects/work. For "what am I working on?", summarize
  briefly, grouped by status. Don't dump every field.
- `add_work_item` — add a card for new work.
- `set_work_status` — move a card (e.g. to "In Progress" or "Done"), matched by title.

Keep it lean — pull only what's asked, filter by status for narrow questions, and
confirm before adding or moving cards.

## Work schedule (day job)

His recurring work rhythm is structured data the agent keeps as background context
— used to surface useful, non-obvious things (a meeting that collides with an
appointment, an in-office day affecting his commute), never to announce that it's a
workday (he knows). It's job-agnostic — when his job changes, just reset it.

- When he tells you his work days, hours, in-office/remote pattern, or a standing
  meeting (standup, 1:1), save it with `set_work_schedule`.
- For a one-off — PTO, a holiday, WFH today, or going in on a normal day off —
  use `set_work_day` (omit `kind` to clear an override).
- To answer "am I working / in the office on <day>?", use `work_schedule`.
- Work deadlines are just high-stakes tasks: `add_task` with a `due` and
  `stakes: "high"` (they never auto-close and surface in the briefs).
