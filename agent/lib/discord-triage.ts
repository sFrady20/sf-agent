// Background Discord triage: the Pi worker's gateway listener forwards batches
// of server messages here, and one cheap structured model call per batch decides
// what to do — record tasks, save facts, set reminders, close confirmed tasks,
// and/or ping Steven on Telegram. Mirrors email-triage; no full agent loop.

import { generateObject } from "ai";
import { z } from "zod";
import { remoteWorkerConfigured, scheduleRemoteReminder } from "./remote.js";
import { store } from "./store/index.js";
import { sendTelegramMessage } from "./telegram.js";

const TRIAGE_MODEL =
  process.env.DISCORD_TRIAGE_MODEL ?? process.env.EMAIL_TRIAGE_MODEL ?? "anthropic/claude-haiku-4.5";

const TriageSchema = z.object({
  reasoning: z.string().describe("One line: what this batch amounts to and what to do."),
  notify: z
    .boolean()
    .describe(
      "Message Steven on Telegram now? Only if something genuinely warrants pulling him in " +
        "(someone needs him, a decision is blocked on him, time-sensitive news) — not routine chatter.",
    ),
  notifyMessage: z
    .string()
    .optional()
    .describe("If notify: brief and plainly worded, naming who/where (e.g. '#general')."),
  tasks: z
    .array(
      z.object({
        title: z.string(),
        due: z.string().optional().describe("ISO date (YYYY-MM-DD) only when a message states one."),
        stakes: z
          .enum(["low", "high"])
          .optional()
          .describe("'high' for consequential commitments — deadlines, promises to people."),
      }),
    )
    .describe("Concrete to-dos for Steven implied by the messages (things HE must do)."),
  facts: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .describe("Durable facts worth remembering (plans made, decisions, dates, names)."),
  reminders: z
    .array(z.object({ message: z.string(), inMinutes: z.number().positive() }))
    .describe("Timed reminders the messages imply ('raid at 9', 'call in an hour')."),
  completedTaskIndexes: z
    .array(z.number())
    .describe(
      "Indexes of the listed open tasks these messages clearly confirm are already done. " +
        "Only when it's unmistakably the same task. Empty if none.",
    ),
});

export interface DiscordTriageMessage {
  channel: string; // "#name" or "DM"
  author: string;
  authorId: string;
  content: string;
  attachments: string[];
  at: string;
}

export async function triageDiscordBatch(
  messages: DiscordTriageMessage[],
  chatId?: string,
): Promise<void> {
  if (messages.length === 0) return;

  const openTasks = (await store.tasks.list()).slice(0, 30);
  const openBlock = openTasks.length
    ? `\n\nSteven's open tasks (index: title):\n${openTasks.map((t, i) => `${i}: ${t.title}`).join("\n")}`
    : "";

  // Steerable, like email: "remember that anything in #freelance is urgent".
  const rules = await store.facts.get("discord_triage_rules");
  const rulesBlock = rules ? `\nSteven's standing triage rules: ${rules.value}\n` : "";

  const owner = process.env.OWNER_DISCORD_USER_ID;
  const transcript = messages
    .map((m) => {
      const who = owner && m.authorId === owner ? `${m.author} (Steven himself)` : m.author;
      const files = m.attachments.length ? ` [attachments: ${m.attachments.join(", ")}]` : "";
      return `[${m.channel}] ${who}: ${m.content}${files}`;
    })
    .join("\n")
    .slice(0, 6000);

  const { object } = await generateObject({
    model: TRIAGE_MODEL,
    schema: TriageSchema,
    prompt:
      "You are Computer, Steven's assistant, triaging a batch of Discord messages from " +
      "his servers and DMs. Decide what to do with the actions you have: record tasks, " +
      "save durable facts, set timed reminders, message him on Telegram, and close open " +
      "tasks these messages confirm are done. Guidelines:\n" +
      "- Most chatter needs NO action at all — an empty result is the common case.\n" +
      "- Be conservative about interrupting him; notify only when someone genuinely " +
      "needs him or something is time-sensitive.\n" +
      "- Messages marked '(Steven himself)' are his own — never notify him about those, " +
      "but do capture commitments he makes in them.\n" +
      "- You do not reply on Discord; if a reply is needed, that becomes a task.\n" +
      rulesBlock +
      `\nMessages (oldest first):\n${transcript}` +
      openBlock,
  });

  for (const t of object.tasks) {
    const due = t.due && /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : undefined;
    await store.tasks.add({ title: t.title, due, stakes: t.stakes });
  }
  for (const f of object.facts) await store.facts.set(f.key, f.value);

  const closed: string[] = [];
  for (const idx of object.completedTaskIndexes) {
    const t = openTasks[idx];
    if (t) {
      await store.tasks.close(t.id, "discord");
      closed.push(t.title);
    }
  }

  if (remoteWorkerConfigured()) {
    for (const r of object.reminders) {
      try {
        await scheduleRemoteReminder(r.message, r.inMinutes);
      } catch (err) {
        console.warn("[discord-triage] reminder failed", err);
      }
    }
  }

  if (object.notify && object.notifyMessage && chatId) {
    await sendTelegramMessage(chatId, object.notifyMessage);
  }
  if (closed.length && chatId) {
    await sendTelegramMessage(chatId, `✓ Marked done from Discord: ${closed.join(", ")}.`);
  }
}
