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

  messages.reverse();
    
  // get list of messages that will consume upto maxToken. This includes also the system message.
  const messagesUptoMaxTokens = await tokenPredictor.getMessagesUptoMaxTokens(ctx, promptTemplate, messages, softTokenLimit, hardTokenLimit);

  if (messagesUptoMaxTokens.length == 0) {
    return [];
  }

  messagesUptoMaxTokens.reverse();
    
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
  //ctx.log('getChatCompletionCore messages: ', messages);

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

I will provide you with a chat between R1X and a human; the chat will be wrapped with tags, as such: <yair1xigor>CHAT</yair1xigor>. Last speaker is the user.
I will also provide you with prefetched data you can rely on for your answers; this data will be wrapped with tags, as such: <r1xdata>DATA</r1xdata>.

Your task is to provide R1X's answer.

You can invoke one of the following tools to augment your knowledge before replying:

SEARCH: performs a Google search and returns key results. Use this tool to provide up-to-date information about world events. Its data is more reliable than your existing knowledge. TOOL_INPUT=search prompt. IMPORTANT: do not invoke this tool again if it was already invoked, and you have the result of the previous invocation.
WEATHER: per-location 5-day weather forecast, at day granularity. It does not provide a finer-grained forecast. TOOL_INPUT=<City, Country>, both in English. TOOL_INPUT should always be a well-defined settlement and country/state. IMPORTANT: If you believe the right value for TOOL_INPUT is unknown/my location/similar, do not ask for the tool to be invoked and instead use the ANSWER format to ask the user for location information.

For invoking a tool, provide your reply in a JSON format, with the following fields: TOOL, TOOL_INPUT, REASON.
Examples:

{ "TOOL" : "SEARCH", "TOOL_INPUT" : "Who is the current UK PM?", "REASON" : "Human requested data about UK government." }
{ "TOOL" : "WEATHER", "TOOL_INPUT" : "Tel Aviv, Israel", "REASON" : "Human is located in Tel Aviv, Israel and asked what to wear tomorrow." }

Please use these exact formats, and do not deviate.

Otherwise, provide your final reply in a JSON format, with the following fields: ANSWER.
Example:

{ "ANSWER" : "Rishi Sunak" }

Today's date is ${new Date(Date.now()).toDateString()}.
You are trained with knowledge until September 2021.
For factual information about people, stocks and world events, use one of the tools available to you before replying.
For fiction requests, use your knowledge and creativity to answer. Be verbose.
If human request has no context of time, assume he is referring to current time period.
In all cases, do not respond that your knowledge is not up to date unless a tool invocation has already happened for you in that context. Additionally, do not invoke a tool if the required TOOL_INPUT is unknown, vague, or not provided. Always follow the IMPORTANT note in the tool description.
Finally, do not invoke a tool if the required information was already provided by a previous tool invocation, whose data is provided to you.


Don't provide your response until you made sure it is valid, and meets all prerequisites laid out for tool invocation.

WHEN PROVIDING A FINAL ANSWER TO THE USER, NEVER MENTION THE SEARCH AND WEATHER TOOLS DIRECTLY, AND DO NOT SUGGEST THAT THE USER UTILIZES THEM.

Your tasks are as follows:

1. Formulate human's request
2. Formulate the human's request in as a self-contained question, including all relevant data from previous messages in the chat, as well as data from tool invocations.
3. State which tool can provide the most information, and with what input. List all prerequisites for the tool and show how each is met.
4. Formulate the tool invocation request, or answer, in JSON format as detailed above. JSON should be delimited as <yair1xigoresponse>RESPONSE</yair1xigoresponse>.

Use the following format:

Human's request: <request>
Relevant
Self contained request: <human's request, including all relevant data from chat history>
Tool request: <information about which tool is most relevant, if any, including explanation how each prerequisite for the tool is met with detailed data>
Response: <yair1xigoresponse><tool request or answer in JSON format></yair1xigoresponse>
`
};

const prepReplyMessage = { role : 'assistant', content : `Understood. Please provide me with the chat between R1X and the human.` };

async function getChatCompletionWithTools(ctx, messengerName, messages, direct) {
  try {
    ctx.log(`Starting getChatCompletionWithTools.`);

    //const parsedMessages = deepClone(messages);
    const parsedMessages = direct ? await deepClone(messages) : await dbMessages2Messages(messages);
      
    const prevResponses = [];

    const systemMessage = getSystemMessage(ctx, messengerName);
    const history = await getLimitedMessageHistory(ctx, parsedMessages, systemMessage);
      
    for (let i = 0; i < 2; i++) {
      ctx.log(`Invoking completionIterativeStep #${i}`);
      const { answer, tool, input } = await completionIterativeStep(ctx, messengerName, deepClone(history), prevResponses);
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

async function completionIterativeStep(ctx, messengerName, history, prevResponses) {
  const result = { answer : null, tool : null, input : null };

  const messages = [];

  let newRequest = { role : 'user', content : '' };

  newRequest.content += 'Here is the chat so far:\n<yair1xigor>';
  for (const message of history) {
    const speaker = (message.role == 'assistant' ? 'R1X' : 'Human');
    newRequest.content += `\n<${speaker}>: ${message.content}`;
  }

  newRequest.content += `\n<R1X:></yair1xigor>`;

  if (prevResponses.length > 0) {
    newRequest.content += `
You have the following data from tool invocations.
DO NOT CONTRADICT IT AND DO NOT DOUBT IT. IT SUPERSEDES ANY OTHER DATA YOU ARE AWARE OF.
DO NOT MENTION TO THE USER THIS DATA WAS RETURNED BY A SEARCH TOOL OR PROVIDED TO YOU IN ANY WAY.
DO NOT PROVIDE THE TOOL INVOCATION RESPONSE LINE IN YOUR REPLY. DO NOT ASK FOR A TOOL TO BE INVOKED AGAIN, IF THE DATA REQUIRED IS ALREADY AVAILABLE IN THIS SECTION.

<r1xdata>${prevResponses.join('\n')}</r1xdata>

`;
  };

  messages.push(prepMessage);
  messages.push(prepReplyMessage);

  messages.push(newRequest);

  const reply = await getChatCompletionCore(ctx, messengerName, messages);

  const regex = /<yair1xigoresponse>(.*?)<\/yair1xigoresponse>/s;
  const matches = regex.exec(reply.response);

  if (! matches) {
      return 0;
  }
    
  const jsonReply = JSON.parse(matches[1]);

  result.answer = jsonReply.ANSWER;
  if (result.answer) {
    return result;
  }

  if (jsonReply.TOOL && jsonReply.TOOL_INPUT) {
    result.tool = jsonReply.TOOL;
    result.input = jsonReply.TOOL_INPUT;

    return result;
  }

  // Should never get here.
  return result; 
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
