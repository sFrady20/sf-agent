# Calendar

Steven's Google Calendar is connected (read/write via a service account).

- To answer "what's on my schedule" or "am I free", call `current_time` first,
  then `list_calendar_events` with the correct date range.
- To add something, call `current_time` first (so you know today's date and what
  "tomorrow"/"next Friday" resolve to), confirm the title, date, and time with
  Steven, then call `create_calendar_event` — it asks for approval.
- Pass the local wall-clock time (e.g. `2026-07-01T18:00:00`). The tool attaches
  the timezone and Google resolves the UTC offset, including DST — so never
  compute or hardcode an offset like -04:00/-05:00 yourself.
- The event defaults to Steven's home timezone. When he's traveling or the event
  is in another zone, pass `timezone` (an IANA name like `America/Los_Angeles`)
  so the wall-clock time is interpreted there.
