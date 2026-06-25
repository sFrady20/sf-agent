// Background email triage: one cheap structured model call per (pre-filtered)
// email that DECIDES what to do with the actions available — record tasks, save
// facts, set a timed reminder, and/or message Steven — instead of only saving
// tasks. No full agent loop, so it stays cheap and behind the spam filter.

import { generateObject } from "ai";
import { z } from "zod";
import { remoteWorkerConfigured, scheduleRemoteReminder } from "./remote.js";
import { store } from "./store/index.js";
import { sendTelegramMessage } from "./telegram.js";

const TRIAGE_MODEL = process.env.EMAIL_TRIAGE_MODEL ?? "anthropic/claude-haiku-4.5";

const TriageSchema = z.object({
  reasoning: z.string().describe("One line: what this email is and what to do."),
  notify: z
    .boolean()
    .describe(
      "Message Steven on Telegram now? Only if it genuinely warrants interrupting him (he already sees his own email) OR the email explicitly asks to be notified.",
    ),
  notifyMessage: z
    .string()
    .optional()
    .describe("If notify: the message to send. Brief, plainly worded, calm and a touch authoritative."),
  tasks: z
    .array(z.object({ title: z.string(), due: z.string().optional() }))
    .describe("Concrete to-dos implied by the email."),
  facts: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .describe("Durable facts worth remembering (appointments, account details, deadlines)."),
  reminders: z
    .array(z.object({ message: z.string(), inMinutes: z.number().positive() }))
    .describe("Timed reminders the email implies, e.g. 'remind me in an hour'."),
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
      "You are Computer, Steven's assistant, triaging one email. Decide what to do " +
      "with the actions you have: record tasks, save durable facts, set timed " +
      "reminders, and/or message him on Telegram. Guidelines:\n" +
      "- Be conservative about interrupting him: he already sees his own email, so " +
      "notify only when it genuinely warrants it OR the email explicitly asks.\n" +
      "- If the email asks you to notify/ping him, set notify=true with a message — " +
      "do not turn that request into a task.\n" +
      "- You do not send replies or write to his calendar here; if those are needed, " +
      "record a task instead.\n\n" +
      `From: ${email.from}\nSubject: ${email.subject}\n\n${email.body.slice(0, 3000)}`,
  });

  for (const t of object.tasks) await store.tasks.add({ title: t.title, due: t.due });
  for (const f of object.facts) await store.facts.set(f.key, f.value);

  if (remoteWorkerConfigured()) {
    for (const r of object.reminders) {
      try {
        await scheduleRemoteReminder(r.message, r.inMinutes);
      } catch (err) {
        console.warn("[email-triage] reminder failed", err);
      }
    }
  }

  if (object.notify && object.notifyMessage && chatId) {
    await sendTelegramMessage(chatId, object.notifyMessage);
  }
}
