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
// 2. Perform request (chat completion, image generation, audio transcript).
// 3. Send answer to chat.
// 4. Remove message from queue.

async function handleIncomingMessage(event) {
  try {
    const parsedEvent = JSON.parse(event);
    const messenger = messengers[parsedEvent.source];
    const parsedMessage = messenger.parseMessage(parsedEvent.event);

    const message = await insertMessage(parsedMessage);

    if (parsedMessage.isSentByMe) {
      return;
    }

    const messageHistory = await getMessageHistory(message);
    const replyMessage = await getChatCompletion(messageHistory);
    console.log({ replyMessage });

    await messenger.sendMessage({
      chatId: parsedMessage.chatId,
      quoteId: parsedMessage.messageId,
      kind: "text",
      body: replyMessage
    });
  } catch (error) {
    console.log(error.stack);
  }
}

module.exports = {
  handleIncomingMessage
};
