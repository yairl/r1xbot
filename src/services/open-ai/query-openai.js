"use strict";
const fs = require('fs');
const { Configuration, OpenAIApi } = require("openai");
const { performance } = require('perf_hooks');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

// Import the OpenAPI Large Language Model (you can import other models here eg. Cohere)
const { OpenAIChat } = require("langchain/llms/openai");

// Import the BufferMemory module
const { PrecalculatedBufferMemory } = require("../langchain/precalculated_buffer_memory");

// Import the Chains module
const { LLMChain } = require("langchain/chains");

// Import the PromptTemplate module
const { PromptTemplate } = require("langchain/prompts");

const tokenPredictor = require("../token-prediction/token-predictor");

function convertMessageToChatFormat(message) {
  const convertedMessage = {
    role: message.isSentByMe ? "assistant" : "user",
    content: message.body
  };

  return convertedMessage;
}

function getPromptTemplate(ctx, messengerName) {
    const queryTemplate = `The following is a conversation between a human and an AI, Robot 1-X, developed by the Planet Express team and integrated into ${messengerName}. R1X is helpful and provides specific details from its context. If R1X does not know the answer to a question, it truthfully says it does not know.
Current conversation:

{chat_history}
AI:`;

    return queryTemplate;
}

async function getLimitedMessageHistory(ctx, messages, promptTemplate) {
  const parsedMessages = [];

  for (const message of messages) {
    // this can happen if the message doesn't have any text, like audio
    if (message.body == null) {
      continue;
    }
    parsedMessages.push(convertMessageToChatFormat(message));
  }

  const softTokenLimit = 2048;
  const hardTokenLimit = 4000;

  // get list of messages that will consume upto maxToken. This includes also the system message.
  const messagesUptoMaxTokens = await tokenPredictor.getMessagesUptoMaxTokens(ctx, promptTemplate, parsedMessages, softTokenLimit, hardTokenLimit);

  if (messagesUptoMaxTokens.length == 0) {
    return [];
  }

  if (messagesUptoMaxTokens[0].role == 'assistant') {
    messagesUptoMaxTokens.shift();
  }

  const mergedMessages = [];

  let prevRole = undefined;

  for (const message of messagesUptoMaxTokens) {
      if (message.role == prevRole) {
        mergedMessages[mergedMessages.length - 1] += `\n${message.content}`;
      } else {
        mergedMessages.push(message.content);
      }

      prevRole = message.role;
  }

  return mergedMessages;
}

async function getChatCompletion(ctx, messengerName, messages) {
  const promptTemplate = getPromptTemplate(ctx, messengerName);
  const messagesUptoMaxTokens = await getLimitedMessageHistory(ctx, messages, promptTemplate);

  ctx.log('getChatCompletion messagesUptoMaxTokens: ', messagesUptoMaxTokens);

  if (messagesUptoMaxTokens.length == 0) {
    ctx.log('Latest user message is longer than hardTokenLimit, bailing out.');
    return 'Your message is longer than I can understand. Can you cut it down a bit?'
  }

  const model = new OpenAIChat({ temperature: 0.9 });

  // Instantiate the BufferMemory passing the memory key for storing state
  const memory = new PrecalculatedBufferMemory({ memoryKey: "chat_history", messages: messagesUptoMaxTokens });

  // Instantiate "PromptTemplate" passing the prompt template string initialized above
  const prompt = PromptTemplate.fromTemplate(getPromptTemplate(ctx, messengerName));

  //Instantiate LLMChain, which consists of a PromptTemplate, an LLM and memory.
  const chain = new LLMChain({ llm: model, prompt, memory });

  try {
    ctx.log('invoking completion request.');

    const res = await chain.call({ input: messagesUptoMaxTokens[messagesUptoMaxTokens.length - 1] });
    ctx.log('getChatCompletion response: ', res.text);

    return {
      response: res.text,
      promptTokens: 0, 
      completionTokens: 0 
    }
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
  const t0 = performance.now();
  const transcription = await openai.createTranscription(  
    fs.createReadStream(mp3FilePath),
    process.env.OPENAI_SPEECH_TO_TEXT_MODEL,
  );
  const timeTaken = (performance.now() - t0).toFixed(0);

  ctx.log(`createTranscription: timeTaken=${timeTaken}ms transcription=${transcription.data.text}`);
  return transcription.data.text;
}

module.exports = {
  getChatCompletion,
  createTranscription
};
