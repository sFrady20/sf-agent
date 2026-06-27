// Effective timezone resolution. Steven can set a travel override (set_location);
// when one is active, every time-aware path — current_time, calendar writes, the
// reminder sweep, the schedules — reasons in that zone instead of his home zone.
// Kept out of time.ts so that module stays a pure, store-free tz toolkit.

import { store } from "./store/index.js";
import { dateInTz, ownerTimezone } from "./time.js";

// The zone to reason in right now: a non-expired travel override, else home.
// Past its `until` date, the override is self-healing — cleared and reverted.
export async function currentTimezone(): Promise<string> {
  const loc = await store.location.get();
  if (!loc) return ownerTimezone();
  if (loc.until && dateInTz(loc.timezone) > loc.until) {
    await store.location.clear();
    return ownerTimezone();
  }
  return loc.timezone;
}
