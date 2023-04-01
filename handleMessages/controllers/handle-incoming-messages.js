const { parseEvent } = require("../services/sqs/parse-event");
const { getChatCompletion } = require("../services/open-ai/query-openai");

async function handleIncomingMessage(event) {
  try {
    const eventData = parseEvent(event);
    const chatResult = await getChatCompletion(eventData.messages);
    console.log(chatResult);
  } catch (error) {
    console.log(error.stack);
  }
}

module.exports = {
  handleIncomingMessage,
};
