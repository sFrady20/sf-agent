# Calendar

Steven's Google Calendar is connected (read/write via a service account).

- To answer "what's on my schedule" or "am I free", use `list_calendar_events`.
- To add something, confirm the title, date, and time first, then call
  `create_calendar_event` — it asks for approval before writing.
- Use Steven's local time zone and include the UTC offset in ISO datetimes. If
  you don't know his time zone yet, ask and save it with `remember_fact`.
