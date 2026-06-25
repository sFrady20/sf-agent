import { telegramChannel } from "eve/channels/telegram";

// Conversational chat surface. Telegram delivers plain DMs over its webhook and
// keys the session by chat, so a private chat is one continuous back-and-forth —
// unlike Discord, which only receives slash commands on a serverless host.
//
//   TELEGRAM_BOT_TOKEN             replies, typing, proactive sends
//   TELEGRAM_WEBHOOK_SECRET_TOKEN  must match the secret_token you register
//   TELEGRAM_BOT_USERNAME          without @, for group mention detection
//   OWNER_TELEGRAM_USER_ID         only this user may talk to the agent
//
// Register the webhook once with setWebhook (see docs/ARCHITECTURE.md).
// Route: POST /eve/v1/telegram

const OWNER = process.env.OWNER_TELEGRAM_USER_ID;

export default telegramChannel({
  botUsername: process.env.TELEGRAM_BOT_USERNAME,
  // Accept inbound photos / PDFs so Steven can send a flyer (or any image) and the
  // vision-capable model can read it — e.g. an event flyer to add to the calendar.
  uploadPolicy: { allowedMediaTypes: ["image/*", "application/pdf"], maxBytes: 15 * 1024 * 1024 },
  // Personal agent: only act on the owner's messages. When OWNER is unset
  // (e.g. before setup) everything is allowed.
  onMessage: (_ctx, message) => {
    const userId = message.from?.id;
    if (OWNER && userId !== OWNER) return null;
    return {
      auth: {
        principalId: userId ?? message.chat.id,
        principalType: "user",
        authenticator: "telegram",
        attributes: { chat_id: message.chat.id, chat_type: message.chat.type },
      },
    };
  },
});
