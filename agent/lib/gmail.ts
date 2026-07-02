// Gmail via OAuth (user refresh token) — a service account can't reach a personal
// inbox (unlike Calendar). Scopes: gmail.modify + gmail.send. Zero deps, fetch.
//
//   GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN
//   GMAIL_PUBSUB_TOPIC   full topic name for users.watch (projects/<p>/topics/<t>)

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

export function gmailConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  );
}

let cached: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!id || !secret || !refresh) {
    throw new Error("Gmail not configured: set GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN.");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Gmail token refresh failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function gmailFetch(path: string, init: { method?: string; body?: string } = {}): Promise<any> {
  const token = await getAccessToken();
  const res = await fetch(`${GMAIL_API}${path}`, {
    method: init.method ?? "GET",
    body: init.body,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
  return res.json();
}

interface GmailMessage {
  id: string;
  snippet?: string;
  labelIds?: string[];
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    parts?: GmailMessage["payload"][];
    body?: { data?: string };
    mimeType?: string;
  };
}

function header(msg: GmailMessage, name: string): string {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

const decodeB64Url = (data: string) => Buffer.from(data, "base64url").toString("utf8");

// Crude but effective plain-texting of an HTML body — enough for triage/reading.
function stripHtml(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findPart(payload: GmailMessage["payload"], mimeType: string): string {
  if (!payload) return "";
  if (payload.mimeType === mimeType && payload.body?.data) return decodeB64Url(payload.body.data);
  for (const part of payload.parts ?? []) {
    const found = findPart(part, mimeType);
    if (found) return found;
  }
  return "";
}

function extractBody(payload: GmailMessage["payload"]): string {
  const plain = findPart(payload, "text/plain");
  if (plain) return plain;
  // HTML-only mail (most commercial senders): strip tags rather than reading blind.
  const html = findPart(payload, "text/html");
  if (html) return stripHtml(html);
  return payload?.body?.data ? decodeB64Url(payload.body.data) : "";
}

export interface EmailSummary {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
}

export async function searchMessages(query: string, max = 10): Promise<EmailSummary[]> {
  const list = (await gmailFetch(
    `/messages?q=${encodeURIComponent(query)}&maxResults=${max}`,
  )) as { messages?: Array<{ id: string }> };
  const msgs = await Promise.all(
    (list.messages ?? []).map(
      (m) =>
        gmailFetch(
          `/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        ) as Promise<GmailMessage>,
    ),
  );
  return msgs.map((m) => ({
    id: m.id,
    from: header(m, "From"),
    subject: header(m, "Subject"),
    date: header(m, "Date"),
    snippet: m.snippet ?? "",
  }));
}

export async function getMessage(
  id: string,
): Promise<{ from: string; subject: string; date: string; body: string }> {
  const m = (await gmailFetch(`/messages/${id}?format=full`)) as GmailMessage;
  return {
    from: header(m, "From"),
    subject: header(m, "Subject"),
    date: header(m, "Date"),
    body: extractBody(m.payload).slice(0, 4000),
  };
}

export interface TriageMessage {
  from: string;
  subject: string;
  body: string;
  labelIds: string[];
  bulk: boolean; // looks like a mailing list / bulk sender
}

export async function getMessageForTriage(id: string): Promise<TriageMessage> {
  const m = (await gmailFetch(`/messages/${id}?format=full`)) as GmailMessage;
  const listUnsub = header(m, "List-Unsubscribe");
  const precedence = header(m, "Precedence");
  return {
    from: header(m, "From"),
    subject: header(m, "Subject"),
    body: extractBody(m.payload).slice(0, 3000),
    labelIds: m.labelIds ?? [],
    bulk: Boolean(listUnsub) || /bulk|list|junk/i.test(precedence),
  };
}

export async function sendEmail(to: string, subject: string, body: string): Promise<{ id: string }> {
  const mime = [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=UTF-8", "", body].join(
    "\r\n",
  );
  const raw = Buffer.from(mime, "utf8").toString("base64url");
  const res = (await gmailFetch(`/messages/send`, {
    method: "POST",
    body: JSON.stringify({ raw }),
  })) as { id: string };
  return { id: res.id };
}

export type MailAction = "archive" | "mark_read" | "mark_unread";

export async function modifyEmail(id: string, action: MailAction): Promise<void> {
  const body =
    action === "archive"
      ? { removeLabelIds: ["INBOX"] }
      : action === "mark_read"
        ? { removeLabelIds: ["UNREAD"] }
        : { addLabelIds: ["UNREAD"] };
  await gmailFetch(`/messages/${id}/modify`, { method: "POST", body: JSON.stringify(body) });
}

// --- Push (Pub/Sub) support ---

export async function startWatch(): Promise<{ historyId: string; expiration: string }> {
  const topic = process.env.GMAIL_PUBSUB_TOPIC;
  if (!topic) throw new Error("Set GMAIL_PUBSUB_TOPIC.");
  return (await gmailFetch(`/watch`, {
    method: "POST",
    body: JSON.stringify({ topicName: topic, labelIds: ["INBOX"] }),
  })) as { historyId: string; expiration: string };
}

// New inbox message ids since a history baseline, plus the mailbox's current
// historyId (the next baseline). Paginates — a big burst can span pages.
// Throws GmailHistoryExpired when the baseline is too old (Gmail keeps ~a week).
export class GmailHistoryExpired extends Error {}

export async function newInboxHistory(
  startHistoryId: string,
): Promise<{ ids: string[]; historyId?: string }> {
  const ids = new Set<string>();
  let historyId: string | undefined;
  let pageToken: string | undefined;
  do {
    let data: {
      history?: Array<{ messagesAdded?: Array<{ message: { id: string } }> }>;
      historyId?: string;
      nextPageToken?: string;
    };
    try {
      data = await gmailFetch(
        `/history?startHistoryId=${encodeURIComponent(startHistoryId)}&historyTypes=messageAdded&labelId=INBOX` +
          (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""),
      );
    } catch (e) {
      if (/Gmail API 404/.test((e as Error).message)) throw new GmailHistoryExpired();
      throw e;
    }
    for (const h of data.history ?? []) {
      for (const a of h.messagesAdded ?? []) ids.add(a.message.id);
    }
    if (data.historyId) historyId = data.historyId;
    pageToken = data.nextPageToken;
  } while (pageToken);
  return { ids: [...ids], historyId };
}
