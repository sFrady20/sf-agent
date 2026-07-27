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
      "Message Steven on Telegram now? The bar: a real person is specifically trying to reach " +
        "HIM, or he'd be sorry to have missed it within the hour. Never for routine chatter, " +
        "announcements, or automated/pasted content. Any actions you record below are reported " +
        "to him automatically — do not notify just to say you recorded something.",
    ),
  notifyMessage: z
    .string()
    .optional()
    .describe("If notify: brief and plainly worded, naming who/where (e.g. '#general')."),
  channelDigests: z
    .array(
      z.object({
        channel: z.string().describe("Channel name exactly as shown in the transcript, e.g. '#gamedev' or 'DM'."),
        summary: z
          .string()
          .describe("1-2 sentences: what was discussed and any outcome. Coarse topics, not a transcript."),
        participants: z.array(z.string()).describe("Display names of who was talking."),
      }),
    )
    .describe(
      "One entry per channel in this batch that had a real conversation, so Steven can later ask " +
        "what people were talking about and where. Skip channels with only noise or one-off remarks.",
    ),
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
    .array(
      z.object({
        key: z.string().describe("Short stable snake_case label, e.g. 'raid_night_schedule'."),
        value: z.string(),
      }),
    )
    .describe(
      "Durable reference info Steven will plausibly ask for later — a firm plan or decision, a " +
        "date, a name he'll need. NOT a recap of the chatter, not one-off remarks (channelDigests " +
        "already covers what was discussed). The bar is high: most batches yield none.",
    ),
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
  channelId: string;
  guildId?: string;
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
      "save durable facts, set timed reminders, message him on Telegram, keep per-channel " +
      "conversation digests, and close open tasks these messages confirm are done. Guidelines:\n" +
      "- Most chatter needs NO action — empty tasks/facts/reminders is the common case; " +
      "channelDigests is the one thing you fill in whenever real conversation happened.\n" +
      "- The notify test: is a real PERSON specifically trying to reach Steven (or is he " +
      "blocking them)? Automated content, bot-style announcements, and general chatter " +
      "never warrant a ping, however urgent their wording sounds.\n" +
      "- Messages marked '(Steven himself)' are his own — never notify him about those, " +
      "but do capture commitments he makes in them.\n" +
      "- You do not reply on Discord; if a reply is needed, that becomes a task.\n" +
      rulesBlock +
      `\nMessages (oldest first):\n${transcript}` +
      openBlock,
  });

  // Rolling conversation memory: coarse per-channel digests, not transcripts.
  for (const digest of object.channelDigests) {
    const source = messages.find((m) => m.channel === digest.channel);
    if (!source) continue; // model named a channel that isn't in this batch
    try {
      await store.conversations.add({
        channel: digest.channel,
        channelId: source.channelId,
        guildId: source.guildId,
        summary: digest.summary,
        participants: digest.participants.slice(0, 10),
      });
    } catch (err) {
      console.warn("[discord-triage] digest save failed", err);
    }
  }

  // Apply actions, collecting a report of what *we* did — Steven's standing
  // rule: tell him what the agent does, not what's happening around him.
  const actions: string[] = [];
  for (const t of object.tasks) {
    const due = t.due && /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : undefined;
    await store.tasks.add({ title: t.title, due, stakes: t.stakes });
    actions.push(`+ task: ${t.title}${due ? ` (due ${due})` : ""}`);
  }
  for (const f of object.facts) {
    await store.facts.set(f.key, f.value);
    // Show what was actually remembered — a bare key reads as noise.
    const value = f.value.length > 60 ? `${f.value.slice(0, 57)}…` : f.value;
    actions.push(`+ remembered ${f.key.replace(/_/g, " ")}: ${value}`);
  }
  for (const idx of object.completedTaskIndexes) {
    const t = openTasks[idx];
    if (t) {
      await store.tasks.close(t.id, "discord");
      actions.push(`✓ closed: ${t.title}`);
    }
  }
  if (remoteWorkerConfigured()) {
    for (const r of object.reminders) {
      try {
        await scheduleRemoteReminder(r.message, r.inMinutes);
        actions.push(`⏰ reminder in ${Math.round(r.inMinutes)}m: ${r.message}`);
      } catch (err) {
        console.warn("[discord-triage] reminder failed", err);
      }
    }
  }

  // One ping at most: the human-notify (if warranted) plus the action report.
  if (!chatId) return;
  const channels = [...new Set(messages.map((m) => m.channel))].join(", ");
  const parts: string[] = [];
  if (object.notify && object.notifyMessage) parts.push(object.notifyMessage);
  if (actions.length) parts.push(`💬 From Discord (${channels}) I did:\n${actions.join("\n")}`);
  if (parts.length) await sendTelegramMessage(chatId, parts.join("\n\n"));
}
