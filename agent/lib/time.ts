// Time-zone helpers for schedules. Vercel runs cron in UTC, but reminders should
// reason in Steven's local day and respect quiet hours. Zero-dep via Intl.

export function ownerTimezone(): string {
  return process.env.OWNER_TIMEZONE ?? "America/New_York";
}

// "YYYY-MM-DD" for the given instant in the given time zone (en-CA renders ISO).
export function dateInTz(tz: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Hour 0–23 in the given time zone.
export function hourInTz(tz: string, at: Date = new Date()): number {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  })
    .formatToParts(at)
    .find((p) => p.type === "hour")?.value;
  return Number.parseInt(part ?? "0", 10) % 24;
}

// Tomorrow's date in tz, as "YYYY-MM-DD".
export function tomorrowInTz(tz: string, at: Date = new Date()): string {
  return dateInTz(tz, new Date(at.getTime() + 86_400_000));
}
