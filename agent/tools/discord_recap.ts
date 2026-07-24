import { defineTool } from "eve/tools";
import { z } from "zod";
import { store } from "../lib/store/index.js";

// Read side of the Discord conversation memory that background triage keeps:
// coarse per-channel digests (topics + who was talking), not transcripts.
export default defineTool({
  description:
    "What's been happening on Discord. Background triage keeps rolling per-channel " +
    "conversation summaries; use this when Steven asks what people were talking about, " +
    "who said something, or where a conversation happened. No channel = overview of " +
    "recently active channels; pass a channel (e.g. '#gamedev') for its recent history. " +
    "Point him to the channel — summaries are coarse, the full thread lives on Discord.",
  inputSchema: z.object({
    channel: z.string().optional().describe("Channel name, e.g. '#gamedev' or 'DM'."),
    limit: z.number().min(1).max(50).optional().describe("Max digest entries (default 15)."),
  }),
  async execute({ channel, limit }) {
    if (!channel) {
      const channels = await store.conversations.channels();
      return channels.length ? { channels } : { channels: [], note: "No Discord activity captured yet." };
    }
    const want = channel.replace(/^#/, "").toLowerCase();
    const match = (await store.conversations.channels()).find(
      (c) => c.channel.replace(/^#/, "").toLowerCase() === want,
    );
    if (!match) return { error: `No captured conversation for '${channel}'.` };
    const entries = await store.conversations.recent({ channelId: match.channelId, limit: limit ?? 15 });
    return { channel: match.channel, entries };
  },
});
