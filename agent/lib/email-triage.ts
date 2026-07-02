// Background email triage: one cheap structured model call per (pre-filtered)
// email that DECIDES what to do with the actions available — record tasks, save
// facts, set a timed reminder, message Steven, and/or close open tasks the email
// confirms are done. No full agent loop, so it stays cheap and behind the spam filter.

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
    .array(
      z.object({
        title: z.string(),
        due: z.string().optional().describe("ISO date (YYYY-MM-DD) only when the email states one."),
        stakes: z
          .enum(["low", "high"])
          .optional()
          .describe(
            "'high' for consequential items — bills, deadlines, appointments. High-stakes tasks keep surfacing until handled; low-stakes ones are quietly assumed done after their due date.",
          ),
      }),
    )
    .describe("Concrete to-dos implied by the email."),
  facts: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .describe("Durable facts worth remembering (appointments, account details, deadlines)."),
  reminders: z
    .array(z.object({ message: z.string(), inMinutes: z.number().positive() }))
    .describe("Timed reminders the email implies, e.g. 'remind me in an hour'."),
  completedTaskIndexes: z
    .array(z.number())
    .describe(
      "Indexes of the listed open tasks that THIS email clearly confirms are already done — a receipt, a 'delivered' notice, an appointment confirmation. Only when it's unmistakably the same task. Empty if none.",
    ),
});

export interface TriageInput {
  from: string;
  subject: string;
  body: string;
}

export async function triageEmail(email: TriageInput, chatId?: string): Promise<void> {
  const openTasks = (await store.tasks.list()).slice(0, 30);
  const openBlock = openTasks.length
    ? `\n\nSteven's open tasks (index: title):\n${openTasks.map((t, i) => `${i}: ${t.title}`).join("\n")}`
    : "";

  // Steven can steer triage conversationally: "remember that emails from my
  // landlord are always urgent" → a fact under this key feeds every triage call.
  const rules = await store.facts.get("email_triage_rules");
  const rulesBlock = rules ? `\nSteven's standing triage rules: ${rules.value}\n` : "";

  const { object } = await generateObject({
    model: TRIAGE_MODEL,
    schema: TriageSchema,
    prompt:
      "You are Computer, Steven's assistant, triaging one email. Decide what to do " +
      "with the actions you have: record tasks, save durable facts, set timed " +
      "reminders, message him on Telegram, and close open tasks this email confirms " +
      "are done. Guidelines:\n" +
      "- Be conservative about interrupting him: he already sees his own email, so " +
      "notify only when it genuinely warrants it OR the email explicitly asks.\n" +
      "- If the email asks you to notify/ping him, set notify=true with a message — " +
      "do not turn that request into a task.\n" +
      "- You do not send replies or write to his calendar here; if those are needed, " +
      "record a task instead.\n" +
      "- If this email clearly confirms one of the listed open tasks is already done " +
      "(a receipt, a delivery, a confirmation), put its index in completedTaskIndexes. " +
      "Only when it is unmistakably the same task.\n" +
      rulesBlock +
      `\nFrom: ${email.from}\nSubject: ${email.subject}\n\n${email.body.slice(0, 3000)}` +
      openBlock,
  });

  for (const t of object.tasks) {
    // Drop a malformed due date rather than storing something unsortable.
    const due = t.due && /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : undefined;
    await store.tasks.add({ title: t.title, due, stakes: t.stakes });
  }
  for (const f of object.facts) await store.facts.set(f.key, f.value);

  // Passive completion: close tasks this email confirms are done.
  const closed: string[] = [];
  for (const idx of object.completedTaskIndexes) {
    const t = openTasks[idx];
    if (t) {
      await store.tasks.close(t.id, "email");
      closed.push(t.title);
    }
  }

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
  // Quiet FYI for passive closes (batched per email), so Steven can object.
  if (closed.length && chatId) {
    await sendTelegramMessage(chatId, `✓ Marked done from your email: ${closed.join(", ")}.`);
  }
}
