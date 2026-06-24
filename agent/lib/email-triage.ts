// Background email triage: one cheap structured model call per (pre-filtered)
// email. Extracts tasks + durable facts into the store, and pings Telegram ONLY
// when something is genuinely time-sensitive. No agent loop — bounded + cheap.

import { generateObject } from "ai";
import { z } from "zod";
import { store } from "./store/index.js";
import { sendTelegramMessage } from "./telegram.js";

const TRIAGE_MODEL = process.env.EMAIL_TRIAGE_MODEL ?? "anthropic/claude-haiku-4.5";

const TriageSchema = z.object({
  timeSensitive: z.boolean().describe("True ONLY if Steven needs to act today or very soon."),
  summary: z.string().describe("One short sentence: what it is and any action."),
  tasks: z.array(z.object({ title: z.string(), due: z.string().optional() })),
  facts: z.array(z.object({ key: z.string(), value: z.string() })),
});

export interface TriageInput {
  from: string;
  subject: string;
  body: string;
}

export async function triageEmail(email: TriageInput, chatId?: string): Promise<void> {
  const { object } = await generateObject({
    model: TRIAGE_MODEL,
    schema: TriageSchema,
    prompt:
      "Triage this email for Steven, a busy developer and dad. Extract concrete " +
      "to-dos and durable facts (appointments, deadlines, account details). Decide " +
      "if it's time-sensitive — needs his attention today or very soon. Be " +
      "conservative: most email is NOT time-sensitive. If nothing is actionable, " +
      "return empty arrays and timeSensitive false.\n\n" +
      `From: ${email.from}\nSubject: ${email.subject}\n\n${email.body.slice(0, 3000)}`,
  });

  for (const t of object.tasks) await store.tasks.add({ title: t.title, due: t.due });
  for (const f of object.facts) await store.facts.set(f.key, f.value);

  if (object.timeSensitive && chatId) {
    await sendTelegramMessage(chatId, `⏰ Time-sensitive — ${email.from}\n${object.summary}`);
  }
}
