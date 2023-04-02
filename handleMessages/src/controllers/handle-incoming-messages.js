const { parseEvent } = require("../services/sqs/parse-event");
const { getChatCompletion } = require("../services/open-ai/query-openai");
const db = require("../db/models");
const { addMessageToChat } = require("../services/chats/chats-service");

async function handleIncomingMessage(event) {
  try {
    const eventData = parseEvent(event);
    console.log({ eventData });
    const message = await addMessageToChat(eventData.messageInfo);
    console.log(message.toJSON());

    //const chatResult = await getChatCompletion(eventData.messages);
    //console.log(chatResult);
  } catch (error) {
    console.log(error.stack);
  }
}

module.exports = {
  handleIncomingMessage
};
