// Shared-secret checks for the webhook channels (cron, gmail, presence).

import { timingSafeEqual } from "node:crypto";

// Constant-time comparison; false when either side is missing.
export function secretMatches(
  provided: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Bearer token from the Authorization header, else a query-param fallback.
// Prefer the header — query strings end up in request logs. The fallback stays
// for callers that can't set headers (Pub/Sub push).
export function bearerOrQuery(req: Request, param: string): string | null {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return bearer || new URL(req.url).searchParams.get(param);
}
