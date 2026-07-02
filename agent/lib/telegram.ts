// Send a plain Telegram message directly via the Bot API — no agent turn, no
// model tokens. Used by the Gmail push webhook for cheap new-mail pings.

const MAX_LEN = 4096; // Telegram's hard message limit
const TIMEOUT_MS = 10_000;

function chunks(text: string): string[] {
  if (text.length <= MAX_LEN) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > MAX_LEN) {
    // Prefer breaking on a newline near the limit.
    const cut = rest.lastIndexOf("\n", MAX_LEN);
    const at = cut > MAX_LEN / 2 ? cut : MAX_LEN;
    out.push(rest.slice(0, at));
    rest = rest.slice(at).replace(/^\n/, "");
  }
  if (rest) out.push(rest);
  return out;
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set.");
  for (const part of chunks(text)) {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: part }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Telegram sendMessage ${res.status}: ${await res.text()}`);
  }
}
