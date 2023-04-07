const logger = require("../../utils/logger");
const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

function convertMessageToChatFormat(message) {
  const convertedMessage = {
    role: message.isSentByMe ? "assistant" : "user",
    content: message.body
  };
  return convertedMessage;
}

async function getChatCompletion(ctx, messages) {
  const systemMessage = {
    role: "system",
    content: `You are a helpful expert assistant, Robot 1-X, integrated into a Telegram chat. Today's date is ${new Date(
      Date.now()
    ).toDateString()}. More information about you is available at https://r1x.ai. When telling about yourself, prefer to provide the link as well.`
  };

  let numTokens = 0;

  const parsedMessages = [];
  messages.reverse();

  for (message of messages) {
    if (message.body == null) {
      continue;
    }

    const asciiOnly = /^[\u0000-\u007f]*$/.test(message.body);
    const tokenScaler = asciiOnly ? 4 : 2;

    numTokens += Math.floor(message.body.length / tokenScaler) + 1;
    if (numTokens > 1080) {
      break;
    }

    parsedMessages.push(convertMessageToChatFormat(message));
  }

  parsedMessages.push(systemMessage);
  parsedMessages.reverse();

  logger.info(`[${ctx}] getChatCompletion messages: `, parsedMessages);

  try {
    logger.info(`[${ctx}] invoking completion request.`);
    const completion = await openai.createChatCompletion({
      model: process.env.OPENAI_MODEL,
      messages: parsedMessages
    });

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
