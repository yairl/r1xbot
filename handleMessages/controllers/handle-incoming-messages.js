const { parseEvent } = require("../services/parse-event");
const { getChatCompletion } = require("../services/query-openai");

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
