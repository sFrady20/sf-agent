import { discordChannel } from "eve/channels/discord";

// Slash-command surface (Telegram is the main chat channel). Discord gives
// slash commands, buttons (for approvals), modals (for input), and proactive
// push. Set these in your environment (see .env.example):
//   DISCORD_PUBLIC_KEY       verifies inbound interaction signatures
//   DISCORD_APPLICATION_ID   edits the deferred reply + sends followups
//   DISCORD_BOT_TOKEN        proactive messages, typing, fallback delivery
//
// Register the slash command once against Discord's API (see docs/ARCHITECTURE.md).
// Route: POST /eve/v1/discord — paste that URL into your app's Interactions
// Endpoint URL in the Discord Developer Portal.

const OWNER = process.env.OWNER_DISCORD_USER_ID;

export default discordChannel({
  // Personal agent: only act on the owner's commands. When OWNER is unset
  // (local dev) everything is allowed.
  onCommand: (_ctx, interaction) => {
    if (OWNER && interaction.user.id !== OWNER) return null;
    return {
      auth: {
        principalId: interaction.user.id,
        principalType: "user",
        authenticator: "discord",
        attributes: {
          channel_id: interaction.channelId,
          guild_id: interaction.guildId ?? "",
        },
      },
    };
  },
});
