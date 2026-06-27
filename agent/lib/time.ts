// Time-zone helpers. Vercel runs cron in UTC, but reminders, schedules, and the
// model should reason in Steven's local day. The host clock is NTP-synced, so it
// is the source of truth for "now"; these helpers project it into the owner's
// timezone with the correct, DST-aware offset. Zero-dep via Intl.

export function ownerTimezone(): string {
  return process.env.OWNER_TIMEZONE ?? "America/New_York";
}

// True if tz is a recognized IANA zone. Guards against a wrong zone silently
// landing an event in the wrong place. Bare abbreviations are rejected: V8
// accepts some (e.g. "EST") but resolves them to a fixed offset that ignores
// DST, so "EST" in summer would skew an hour. Require a "Region/City" name (or
// UTC/GMT) so the offset is always DST-aware.
export function isValidTimeZone(tz: string): boolean {
  if (tz !== "UTC" && tz !== "GMT" && !tz.includes("/")) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
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

// UTC offset string "±HH:MM" for tz at the given instant (DST-aware).
export function tzOffset(tz: string, at: Date = new Date()): string {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  // longOffset renders "GMT-04:00", or bare "GMT" at exactly +00:00.
  return name.replace("GMT", "") || "+00:00";
}

// The same offset, in signed minutes.
export function tzOffsetMinutes(tz: string, at: Date = new Date()): number {
  const off = tzOffset(tz, at); // ±HH:MM
  const sign = off.startsWith("-") ? -1 : 1;
  const [h, m] = off.slice(1).split(":").map(Number);
  return sign * (h * 60 + (m || 0));
}

// Whether tz is currently observing daylight saving (offset differs from the
// year's standard offset). False for zones that don't observe DST.
export function isDST(tz: string, at: Date = new Date()): boolean {
  const y = at.getUTCFullYear();
  const jan = tzOffsetMinutes(tz, new Date(Date.UTC(y, 0, 1)));
  const jul = tzOffsetMinutes(tz, new Date(Date.UTC(y, 6, 1)));
  if (jan === jul) return false; // no DST in this zone
  return tzOffsetMinutes(tz, at) !== Math.min(jan, jul); // standard = smaller offset
}

// Full local datetime as "YYYY-MM-DDTHH:MM:SS±HH:MM" for use in prompts.
export function localNow(tz: string = ownerTimezone(), at: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  const hour = g("hour") === "24" ? "00" : g("hour"); // Node renders midnight as 24
  return `${g("year")}-${g("month")}-${g("day")}T${hour}:${g("minute")}:${g("second")}${tzOffset(tz, at)}`;
}

// Strip any trailing UTC offset/Z, leaving naive wall-clock "YYYY-MM-DDTHH:MM[:SS]".
// Used to hand a calendar event's wall-clock time to Google alongside an explicit
// timeZone, so Google (not us, and not the model's guess) resolves the offset.
export function stripOffset(iso: string): string {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)/);
  return m ? m[1] : iso;
}
