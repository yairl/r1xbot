const { getChatCompletion } = require("../services/open-ai/query-openai");
const db = require("../db/models");
const {
  insertMessage,
  getMessageHistory
} = require("../services/messages/messages-service");
const messengers = require("../services/messengers");

// Handle incoming message from ingress SQS queue.
//
// 1. Insert message to DB.
// 2. Generate reply (chat completion, image generation, audio transcript).
// 3. Send reply to user.

async function handleIncomingMessage(ctx, event) {
  try {
    // 1. Parse message and insert to database
    const parsedEvent = JSON.parse(event);
    const messenger = messengers[parsedEvent.source];
    const parsedMessage = messenger.parseMessage(parsedEvent.event);

    const message = await insertMessage(ctx, parsedMessage);

    // If this is a callback notifying us of a message we sent, we're done processing and can exit.
    if (message.isSentByMe || message.body == null) {
      return;
    }

    // If this is a group chat, only reply if it's direct at us.
    if (! messenger.isMessageForMe(message)) {
      return;
    }

    // 2. Generate reply
    const messageHistory = await getMessageHistory(ctx, message);
    console.log(`[${ctx}] message history pulled.`);

    const replyMessage = await getChatCompletion(ctx, messageHistory);
    console.log(`[${ctx}] `, { replyMessage });

    // 3. Send reply to user
    await messenger.sendMessage(ctx, {
      chatId: parsedMessage.chatId,
      kind: "text",
      body: replyMessage
    });
    return `replied: ${replyMessage}`;
  } catch (error) {
    console.log(`[${ctx}] `, error.stack);
    throw new Error(`[${ctx}] Message processing failed.`);
  }
}

module.exports = {
  handleIncomingMessage
};
