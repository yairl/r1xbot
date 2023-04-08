"use strict";
const logger = require("../../utils/logger");
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);
const tokenPredictor = require("../token-prediction/token-predictor");

function convertMessageToChatFormat(message) {
  const convertedMessage = {
    role: message.isSentByMe ? "assistant" : "user",
    content: message.body
  };
  return convertedMessage;
}

async function getChatCompletion(ctx, messages) {
  // messages are ordered old-->new
  const systemMessage = {
    role: "system",
    content: `You are a helpful expert assistant, Robot 1-X, developed by the Planet Express team and integrated into a Telegram chat. Today's date is ${new Date(
      Date.now()
    ).toDateString()}. More information about you is available at https://r1x.ai. When telling about yourself, prefer to provide the link as well.`
  };

  let numTokens = 0;

  const parsedMessages = [];

  for (let message of messages) {
    parsedMessages.push(convertMessageToChatFormat(message));
  }

  const maxTokens = 1080;
  // get list of messages that will consume upto maxToken. This includes also the system message.
  let messagesUptoMaxTokens = await tokenPredictor.getMessagesUptoMaxTokens(ctx, systemMessage, parsedMessages, maxTokens);

  logger.info(`[${ctx}] getChatCompletion messagesUptoMaxTokens: `, messagesUptoMaxTokens);

  try {
    logger.info(`[${ctx}] invoking completion request.`);
    const completion = await openai.createChatCompletion({
      model: process.env.OPENAI_MODEL,
      messages: messagesUptoMaxTokens
    });

    let expectedNumTokens = await tokenPredictor.numTokensFromMessages(messagesUptoMaxTokens);
    logger.info(`[${ctx}] getChatCompletion expectedNumTokens:`, expectedNumTokens, `actual completion.data.usage.prompt_tokens:`, completion.data.usage.prompt_tokens);

    logger.info(`[${ctx}] getChatCompletion response: `, completion.data.choices[0].message.content);

    return completion.data.choices[0].message.content;
  } catch (e) {
    if (e.response) {
      logger.info(`[${ctx}] error: `, e.response.status, e.response.data);
    } else {
      logger.info(`[${ctx}] error: `, e.message);
    }

    throw new Error(`[${ctx}] error generation completion from OpenAI.`);
  }
}

// TODO whisper
// async function getTranscript(filePath) {
//   const openedFile =
//   const transcript = openai.createTranscription()
// }

module.exports = {
  getChatCompletion
};
