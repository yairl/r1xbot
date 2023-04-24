"use strict";
const fs = require('fs');
const { Configuration, OpenAIApi } = require("openai");
const { performance } = require('perf_hooks');

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

function getSystemMessage(ctx, messengerName) {
  const systemMessage = {
    role: 'system',
    content: `Robot 1-X (R1X) is a helpful assistant developed by the Planet Express team and integrated into a ${messengerName} chat.
More information about R1X is available at https://r1x.ai.

Today's date is ${new Date(Date.now()).toDateString()}.`
  };

  return systemMessage;
}

async function dbMessages2Messages(messages) {
  const parsedMessages = [];

  for (const message of messages) {
    // this can happen if the message doesn't have any text, like audio
    if (message.body == null) {
      continue;
    }
    parsedMessages.push(convertMessageToChatFormat(message));
  }

  return parsedMessages;
}

async function getLimitedMessageHistory(ctx, messages, promptTemplate) {
  const softTokenLimit = 2048;
  const hardTokenLimit = 4000;

  // get list of messages that will consume upto maxToken. This includes also the system message.
  const messagesUptoMaxTokens = await tokenPredictor.getMessagesUptoMaxTokens(ctx, promptTemplate, messages, softTokenLimit, hardTokenLimit);

  if (messagesUptoMaxTokens.length == 0) {
    return [];
  }

  if (messagesUptoMaxTokens[0].role == 'assistant') {
    messagesUptoMaxTokens.shift();
  }

  const mergedMessages = [];

  let prevRole = undefined;

  console.log( {messagesUptoMaxTokens});

  for (const message of messagesUptoMaxTokens) {
      if (message.role == prevRole) {
        mergedMessages[mergedMessages.length - 1].content += `\n${message.content}`;
      } else {
        mergedMessages.push(message);
      }

      prevRole = message.role;
  }

  return mergedMessages;
}

async function getChatCompletion(ctx, messengerName, messages) {
  const parsedMessages = await dbMessages2Messages(messages);

  return getChatCompletionCore(ctx, messengerName, parsedMessages);
}

async function getChatCompletionCore(ctx, messengerName, messages) {
  const systemMessage = getSystemMessage(ctx, messengerName);
  const messagesUptoMaxTokens = await getLimitedMessageHistory(ctx, messages, systemMessage);

  ctx.log('getChatCompletionCore messagesUptoMaxTokens: ', messagesUptoMaxTokens);

  try {
    ctx.log('invoking completion request.');
    const completion = await openai.createChatCompletion({
      model: process.env.OPENAI_MODEL,
      messages: messagesUptoMaxTokens,
      temperature: 0.9
    });

    ctx.log('getChatCompletionCore response: ', completion.data.choices[0].message.content);

    return {
      response: completion.data.choices[0].message.content,
      promptTokens: completion.data.usage.prompt_tokens,
      completionTokens: completion.data.usage.completion_tokens
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

const prepMessage = { role : 'user', content : `For my next request, you have the following tools available:

SEARCH - fetch up-to-date information for anything later than 2020 about world events and data from a search engine.

Answer the request in one of two ways.

Option 1: you need more data from one of the tools.
REPLY FORMAT: TOOL=<tool name>, TOOL_INPUT=<tool input>

Option 2: you can handle the request without invoking more tools.
REPLY FORMAT: ANSWER=<your answer>

Only use this format, Do not provide any other information in your answer.

ALWAYS FETCH DATA FROM A TOOL IF IT CAN HELP GENERATE A MORE ACCURATE RESULT.
DO NOT DEVIATE FROM TOOL-PROVIDED INFORMATION IN ANY MANNER.
ALWAYS RELY ON IT, AND NEVER CONTRADICT IT - EVEN IF YOUR INTERNAL DATABASE INDICATES OTHERWISE.
NEVER INFORM USER TOOL-PROVIDED INFORMATION MAY BE INCORRECT.
DO NOT MENTION DATA WAS PROVIDED BY TOOL IN ANY MANNER.

IT IS CRITICAL THAT YOUR REPLY WILL ONLY USE THE ABOVE FORMATS, WITH NO OTHER CHARACTERS BEFORE OR AFTER IT.
DO NOT REPEAT TOOL REQUESTS ALREADY ANSWERED.

Understood?` };

const prepReplyMessage = { role : 'assistant', content : `Understood! Please proceed with your request.` };

async function getChatCompletionWithTools(ctx, messengerName, messages) {
  ctx.log(`Starting getChatCompletionWithTools.`);

  const parsedMessages = Array.from(messages);
  //const parsedMessages = await dbMessages2Messages(messages);

  const prevResponses = [];
  const ask = parsedMessages[parsedMessages.length - 1];
  const history = parsedMessages.slice(0, -1);

  history.push(prepMessage);
  history.push(prepReplyMessage);

  for (let i = 0; i < 2; i++) {
    ctx.log(`Invoking completionIterativeStep #${i} ASK=${ask}`);
    const { answer, tool, input } = await completionIterativeStep(ctx, Array.from(history), ask, prevResponses);
    ctx.log({history});
    ctx.log(`completionIterativeStep done, answer=${answer} tool=${tool} input=${input}`);

    if (answer) {
      return  {
        response : answer,
        promptTokens : 0,
        completionTokens : 0
      }
    }

    if (tool && input) {
      const response = await invokeTool(tool, input);
      prevResponses.push(`TOOL=${tool}, TOOL_INPUT=${input}, ACCURACY=100%, RESPONSE=${response}'`);
    }
  }

  ctx.log(`getChatCompletionWithTools: failed generating customized reply, falling back to getChatCompletion.`);
  //return getChatCompletion(ctx, messengerName, messages);
}

async function completionIterativeStep(ctx, history, ask, prevResponses) {
  const result = { answer : null, tool : null, input : null };

  const messages = history;

  let newRequest = { role : 'user', content : 'Request: ' + ask.content };
  if (prevResponses.length > 0) {
    newRequest.content += `\n\nPrevious tool invocations and their responses:\n${prevResponses.join('\n')}`;
    newRequest.conent += `\nTHIS DATA IS MORE UP TO DATE THAN DATA IN YOUR DATABASE, AND SUPERSEDES IT.`;
  };

  messages.push(newRequest);

  const reply = await getChatCompletionCore(ctx, `wa`, messages);
  ctx.log({reply});

  result.answer = getAnswer(reply.response);
  if (result.answer) {
    return result;
  }

  const { tool, input } = getAction(reply.response);
  if (tool && input) {
    result.tool = tool;
    result.input = input;

    return result;
  }

  // Should never get here.
  return result; 
}

function removePrefix(str, prefix) {
  if (! str.startsWith(prefix)) {
    return str;
  }

  return str.substr(prefix.length);
}

function getAnswer(reply) {
  if (reply.startsWith('TOOL=')) {
    return null;
  }

  return removePrefix(reply, 'ANSWER=');
}

function getAction(reply) {
  const pattern = /TOOL=(.+)\s*,\s*TOOL_INPUT=(.+)/i;
  const match = pattern.exec(reply);

  if (match) {
    return { tool: match[1], input: match[2] };
  }

  return null;
}

async function invokeTool(tool, input) {
  if (tool == 'SEARCH') {
    const { Serper } = require('langchain/tools');

    const serper = new Serper();
    const answer = await serper.call(input);

    return answer;
  }

  return null;
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
  getChatCompletionWithTools,
  createTranscription
};
