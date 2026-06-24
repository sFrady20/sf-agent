// Google Calendar access via a service account — no per-user OAuth dance.
// Share your calendar with the service account's email (Make changes to events),
// then set GOOGLE_CALENDAR_ID to your calendar (your email address).
//
// Zero dependencies: we sign a JWT with Node crypto and exchange it for an
// access token (the OAuth2 service-account / "two-legged" flow), matching the
// fetch-only style of lib/store.

import { createSign } from "node:crypto";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface ServiceAccount {
  email: string;
  privateKey: string;
}

function loadServiceAccount(): ServiceAccount | null {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !privateKey) return null;
  // Env stores the PEM with literal "\n" — restore real newlines.
  return { email, privateKey: privateKey.replace(/\\n/g, "\n") };
}

export function googleConfigured(): boolean {
  return loadServiceAccount() !== null;
}

export function calendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID ?? "primary";
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

let cached: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const sa = loadServiceAccount();
  if (!sa) {
    throw new Error(
      "Google not configured: set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.",
    );
  }

  const iat = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.email,
    scope: CALENDAR_SCOPE,
    aud: TOKEN_URL,
    iat,
    exp: iat + 3600,
  };
  const signingInput = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(
    JSON.stringify(claims),
  )}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(sa.privateKey);
  const assertion = `${signingInput}.${b64url(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export async function calendarFetch(
  path: string,
  init: { method?: string; body?: string } = {},
): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`${CALENDAR_API}${path}`, {
    method: init.method ?? "GET",
    body: init.body,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Calendar API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
