const { getChatCompletion } = require("../services/open-ai/query-openai");
const db = require("../db/models");
const { insertMessage } = require("../services/messages/messages-service");

// Handle incoming message from ingress SQS queue.
//
// 1. Insert message to DB.
// 2. Perform request (chat completion, image generation, audio transcript).
// 3. Send answer to chat.
// 4. Remove message from queue.

async function handleIncomingMessage(event) {
  try {
    const parsedEvent = JSON.parse(event.Records[0].body);

    const messenger = require("../services/messengers/" + parsedEvent.source);
    const parsedMessage = messenger.parseMessage(parsedEvent.event);

    const message = await insertMessage(parsedEvent);
    //console.log(message.toJSON());

    //const chatResult = await getChatCompletion(eventData.messages);
    //console.log(chatResult);
  } catch (error) {
    console.log(error.stack);
  }
}

module.exports = {
  handleIncomingMessage
};
