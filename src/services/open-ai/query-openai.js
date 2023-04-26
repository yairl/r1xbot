"use strict";
const fs = require('fs');
const { Configuration, OpenAIApi } = require("openai");
const { performance } = require('perf_hooks');

const querystring = require('querystring');

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);
const tokenPredictor = require("../token-prediction/token-predictor");

function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

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
If R1X does not know, it truthfully says it does not know.
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
      temperature: 0.2
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

const prepMessage = { role : 'user', content : `For my next message, you can invoke an additional tool to augment your knowledge before replying.
You have the following tools available:

TOOL: SEARCH - performs a Google search and returns results from the top page. FORMAT: search prompt.
TOOL: WEATHER - preferred tool for weather information. FORMAT: City, Country, both in English. Data returned as a 5-day weather data in JSON format.

Your knowledge is updated to September 2021 and it is now  ${new Date(Date.now()).toDateString()}.
At any case where such data may be helpful, please reply with the following format:

TOOL=SEARCH TOOL_INPUT=<search prompt>

In all other cases, start your reply with:

ANSWER=<your answer>

DO NOT DEVIATE FROM THIS FORMAT, KEEPING ALL FORMATTING OPTIONS SUCH AS UPPERCASE/LOWERCASE, EXACT WORDS ETC EXACTLY THE SAME.

I will perform that search and provide you with the result in a separate message.
Otherwise, provide your answer.

IT IS CRITICAL THAT YOUR REPLY WILL ONLY USE THIS EXACT FORMAT, WITH NO OTHER CHARACTERS BEFORE OR AFTER IT.

Note: Next message should be treated as if it is part of a natural chat containing all previous messages, in chronological order.
`
};

const prepReplyMessage = { role : 'assistant', content : `Understood! Please proceed.` };

async function getChatCompletionWithTools(ctx, messengerName, messages) {
  try {
    ctx.log(`Starting getChatCompletionWithTools.`);

    //const parsedMessages = deepClone(messages);
    const parsedMessages = await dbMessages2Messages(messages);

    const prevResponses = [];
    const ask = parsedMessages[parsedMessages.length - 1];
    const history = parsedMessages.slice(0, -1);

    for (let i = 0; i < 2; i++) {
      ctx.log(`Invoking completionIterativeStep #${i} ASK=${ask}`);
      const { answer, tool, input } = await completionIterativeStep(ctx, messengerName, deepClone(history), ask, prevResponses);
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
        prevResponses.push(`TOOL=${tool}, TOOL_INPUT=${input}, ACCURACY=100%, DATE=${new Date(Date.now()).toDateString()}.\n${response}'`);
      }
    }
  } catch (e) {
    ctx.log(`getChatCompletionWithTools: failed generating customized reply, falling back to getChatCompletion.`);
    ctx.log({e});  
    return getChatCompletion(ctx, messengerName, messages);
  }
}

async function completionIterativeStep(ctx, messengerName, history, ask, prevResponses) {
  const result = { answer : null, tool : null, input : null };

  const messages = history;

  let newRequest = { role : 'user', content : '' };
  newRequest.content += `Message: ${ask.content}`;

  if (prevResponses.length > 0) {
    newRequest.content += `
You also have data from previous tool invocations.
DO NOT CONTRADICT IT AND DO NOT DOUBT IT. IT SUPERSEDES ANY OTHER DATA YOU ARE AWARE OF.
DO NOT MENTION TO THE USER THIS DATA WAS RETURNED BY A SEARCH TOOL OR PROVIDED TO YOU IN ANY WAY.
DO NOT PROVIDE THE TOOL INVOCATION RESPONSE LINE IN YOUR REPLY.

Data:

${prevResponses.join('\n')}

`;
  };


  messages.push(prepMessage);
  messages.push(prepReplyMessage);

  messages.push(newRequest);

  const reply = await getChatCompletionCore(ctx, messengerName, messages);
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

  return removePrefix(removePrefix(reply, 'ANSWER='), 'ANSWER: ');
}

function getAction(reply) {
  const pattern = /TOOL=(.+)\s* \s*TOOL_INPUT=(.+)/i;
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

  if (tool == 'WEATHER') {
    const answer = invokeWeatherSearch(input);
    
    return answer;
  }

  return null;
}

function parseGeolocation(locationData) {
  const regex = /^(\d+\.\d+)\° ([NSEW]),\s*(\d+\.\d+)\° ([NSEW])$/;
  const match = locationData.match(regex);

  if (! match) {
    return undefined;
  }

  const lat = parseFloat(match[1]) * (match[2] === "S" ? -1 : 1);
  const lon = parseFloat(match[3]) * (match[4] === "W" ? -1 : 1);

  return { lat, lon };
}

async function invokeWeatherSearch(input) {
  const {Serper } = require('langchain/tools');
  const serper = new Serper();
  const geoRes = await serper._call(`${input} long lat`);
  const { lat, lon } = parseGeolocation(geoRes);

  const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_hours,precipitation_probability_max,windspeed_10m_max&forecast_days=3&timezone=auto`)
  const wResJson = await wRes.json();

  return JSON.stringify(wResJson.daily);
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
