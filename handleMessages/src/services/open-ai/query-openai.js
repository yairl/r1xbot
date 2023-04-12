"use strict";
const fs = require('fs');
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

  const parsedMessages = [];

  for (const message of messages) {
    // this can happen if the message doesn't have any text, like audio
    if (message.body == null) {
      continue;
    }
    parsedMessages.push(convertMessageToChatFormat(message));
  }

  const maxTokens = 2048;
  // get list of messages that will consume upto maxToken. This includes also the system message.
  const messagesUptoMaxTokens = await tokenPredictor.getMessagesUptoMaxTokens(ctx, systemMessage, parsedMessages, maxTokens);

  ctx.log('getChatCompletion messagesUptoMaxTokens: ', messagesUptoMaxTokens);

  try {
    ctx.log('invoking completion request.');
    const completion = await openai.createChatCompletion({
      model: process.env.OPENAI_MODEL,
      messages: messagesUptoMaxTokens
    });

    const expectedNumTokens = await tokenPredictor.numTokensFromMessages(messagesUptoMaxTokens);
    ctx.log(`getChatCompletion expectedNumTokens: ${expectedNumTokens}, actual completion.data.usage.prompt_tokens: ${completion.data.usage.prompt_tokens}`);

    ctx.log('getChatCompletion response: ', completion.data.choices[0].message.content);

    return completion.data.choices[0].message.content;
  } catch (e) {
    if (e.response) {
      ctx.log('error: ', e.response.status, e.response.data);
    } else {
      ctx.log('error: ', e.message);
    }

    ctx.log('error generating completion from OpenAI.');
    throw new Error('error generating completion from OpenAI.');
  }
}


async function createTranscription(ctx, mp3FilePath) {
  const transcription = await openai.createTranscription(  
    fs.createReadStream(mp3FilePath),
    process.env.OPENAI_SPEECH_TO_TEXT_MODEL,
  );

  ctx.log(`createTranscription transcription=${transcription.data.text}`);
  return transcription.data.text;
}

module.exports = {
  getChatCompletion,
  createTranscription
};
