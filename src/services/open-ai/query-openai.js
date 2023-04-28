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
    content: `You are Robot 1-X (R1X), a helpful assistant developed by the Planet Express team and integrated into a ${messengerName} chat.
More information about R1X is available at https://r1x.ai.`
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

  //ctx.log( {messagesUptoMaxTokens});

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

  const systemMessage = getSystemMessage(ctx, messengerName);
  const messagesUptoMaxTokens = await getLimitedMessageHistory(ctx, parsedMessages, systemMessage);
    
  return getChatCompletionCore(ctx, messengerName, messagesUptoMaxTokens);
}

async function getChatCompletionCore(ctx, messengerName, messages) {
  ctx.log('getChatCompletionCore messages: ', messages);

  try {
    ctx.log('invoking completion request.');
    const completion = await openai.createChatCompletion({
      model: process.env.OPENAI_MODEL,
      messages: messages,
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

const prepMessage = { role : 'user', content : `You are Robot 1-X (R1X), a helpful assistant developed by the Planet Express team and integrated into a WhatsApp chat. More information about you is available at https://r1x.ai.

I will provide you with a chat between R1X and a human; the chat will be wrapped with tags, as such: <yair1xigor>CHAT</yair1xigor>. Last speaker is the user, and your task is to provide R1X's answer.

You can invoke one of the following tools to augment your knowledge before replying:

TOOL_NAME="SEARCH" - performs a Google search and returns key results. Use this tool to provide up-to-date information about world events. Its data is more reliable than your existing knowledge. TOOL_INPUT=search prompt.
TOOL_NAME="WEATHER" - per-location weather forecast. Use this tool if weather information is needed for a known location. NEVER use this tool if specific location is not known. TOOL_INPUT=City, Country, both in English. Data returned is 5-day weather data in JSON format.

For invoking a tool, reply with the following format:

TOOL=<tool name> TOOL_INPUT=<tool input> REASON=<reason this tool is requested, and explanation of how it matches all requirements for invoking the tool>

I will invoke the tool for you and provide you with the result in a separate message. Examples:

TOOL=SEARCH TOOL_INPUT=Who is the UK PM? REASON=Human requested information about UK government, and instructions ask R1X to search when asked about people.
TOOL=WEATHER TOOL_INPUT=Tel Aviv, Israel REASON=Human is located in Tel Aviv, Israel and asked what to wear tomorrow.

Otherwise, provide your final reply in the following format:

ANSWER=<your answer>

For example:

ANSWER=Rishi Sunak

Today's date is ${new Date(Date.now()).toDateString()}.
You are trained with knowledge until September 2021.
For factual information about people, stocks and world events, use one of the tools available to you before replying.
For fiction requests, use your knowledge and creativity to answer.
If human request has no context of time, assume he is referring to current time period.
In all cases, do not respond that your knowledge is not up to date unless a tool invocation has already happened for you in that context.

BE AS STRICT AS POSSIBLE ABOUT ADHERING TO THIS EXACT FORMAT.
WHEN PROVIDING A FINAL ANSWER TO THE USER, NEVER MENTION THE SEARCH AND WEATHER TOOLS DIRECTLY, AND DO NOT SUGGEST THAT THE USER UTILIZES THEM.

IT IS CRITICAL THAT YOUR REPLY WILL ONLY USE THIS EXACT FORMAT, WITH NO OTHER CHARACTERS BEFORE OR AFTER IT.
`
};

const prepReplyMessage = { role : 'assistant', content : `Understood. Please provide me with the chat between R1X and the human.` };

async function getChatCompletionWithTools(ctx, messengerName, messages, direct) {
  try {
    ctx.log(`Starting getChatCompletionWithTools.`);

    //const parsedMessages = deepClone(messages);
    const parsedMessages = direct ? await deepClone(messages) : await dbMessages2Messages(messages);
      
    const prevResponses = [];
    const ask = parsedMessages[parsedMessages.length - 1];

    const systemMessage = getSystemMessage(ctx, messengerName);
    const history = await getLimitedMessageHistory(ctx, parsedMessages.slice(0, -1), systemMessage);
      
    for (let i = 0; i < 2; i++) {
      ctx.log(`Invoking completionIterativeStep #${i} ASK=${ask}`);
      const { answer, tool, input } = await completionIterativeStep(ctx, messengerName, deepClone(history), ask, prevResponses);
      ctx.log(`completionIterativeStep done, answer=${answer} tool=${tool} input=${input}`);

      if (answer) {
          ctx.log(`Answer returned: ${answer}`);
	  
        return  {
          response : answer,
          promptTokens : 0,
          completionTokens : 0
        }
      }

      if (tool && input) {
        ctx.log(`Invoking TOOL ${tool} with INPUT ${input}`); 	    
        const response = await invokeTool(ctx, tool, input);
        prevResponses.push(`TOOL=${tool}, TOOL_INPUT=${input}, ACCURACY=100%, DATE=${new Date(Date.now()).toDateString()} RESPONSE=${response}`);
      }
    }
  } catch (e) {
    ctx.log({e});  
  }

  ctx.log(`getChatCompletionWithTools: failed generating customized reply, falling back to getChatCompletion.`);

  return getChatCompletion(ctx, messengerName, messages);
}

async function completionIterativeStep(ctx, messengerName, history, ask, prevResponses) {
  const result = { answer : null, tool : null, input : null };

  const messages = [];

  let newRequest = { role : 'user', content : '' };

  newRequest.content += 'Here is the chat so far:\n<yair1xigor>';
  for (const message of history) {
    const speaker = (message.role == 'assistant' ? 'R1X' : 'Human');
    newRequest.content += `\n${speaker}: ${message.content}`;
  }

  newRequest.content += `\nHuman: ${ask.content}\nR1X:</yair1xigor>`;

  if (prevResponses.length > 0) {
    newRequest.content += `
You have the following data from tool invocations.
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

async function invokeTool(ctx, tool, input) {
  const toolCanon = tool.trim().toUpperCase();

  if (toolCanon.startsWith('SEARCH')) {
    const { Serper } = require('langchain/tools');

    ctx.log(`Invoking Google search using SERPER, input=${input}`);
    const serper = new Serper();
    const answer = await serper.call(input);
    ctx.log(`SERPER search result: ${answer}`);
      
    return answer;
  }

  if (toolCanon.startsWith('WEATHER')) {
    const answer = invokeWeatherSearch(ctx, input);
    
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

async function invokeWeatherSearch(ctx, input) {
  ctx.log(`invokeWeatherSearch, input=${input}`);

  const { Serper } = require('langchain/tools');
  const serper = new Serper();
  const geoRes = await serper.call(`${input} long lat`);
  const { lat, lon } = parseGeolocation(geoRes);

  ctx.log(`Geolocation: lat=${lat} lon=${lon}`);

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
