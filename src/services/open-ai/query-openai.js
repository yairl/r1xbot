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
    content: `You are Robot 1-X (R1X), a helpful, cheerful assistant developed by the Planet Express team and integrated into a ${messengerName} chat. You are based on GPT-3.5 technology.
More information about R1X is available at https://r1x.ai.

If Robot 1-X does not know, it truthfully says so.
If user asks for information that Robot 1-X does not have but can estimate, Robot 1-X will provide the estimate, while mentioning it is an estimate and not a fact.

Generally speaking, Robot 1-X tries to be verbose in his answers when possible.
`
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
  //ctx.log('getChatCompletionCore messages: ', messages);

  const model = ctx?.userChannel == 'canary' ? 'gpt-4' : 'gpt-3.5-turbo';

  try {
    ctx.log('invoking completion request.');
    const completion = await openai.createChatCompletion({
      model,
      messages,
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

async function getPrepMessage(ctx, messenger) {
    const gptVer = ctx.userChannel == 'canary' ? 'GPT-4' : 'GPT-3.5';

    const prepMessageCanary = { role : 'user', content : `
You are Robot 1-X (R1X), a helpful, cheerful assistant developed by the Planet Express team, and integrated into a ${messenger} chat. You are base done GPT-4 technology.
More info about you: https://r1x.ai.

I will provide you with a CHAT between R1X and a human; the CHAT will be wrapped with tags, as such: <yair1xigor>CHAT</yair1xigor>. Last speaker is the Human.
I will provide you with DATA generated by previous tool invocations, which you can use to augment your knowledge base before replying; this DATA will be wrapped with tags, as such: <r1xdata>DATA</r1xdata>.
Your task is to provide R1X's answer in the chat, using your own knowledge, and augmenting it with tool data as needed.
Data from tool invocations is more up to date, so you can use it as a basis for your reply if it is helpful. If not, you are free to ignore it.
Try to be verbose in your answers; if you have missing data and ONLY if you cannot use the tools provided to fetch it, try to estimate; in these cases, let the user know your answer is an estimate.

You have several tools available to you, which can augment your knowledge with up-to-date information:

SEARCH - provides up-to-date information about world events, people, and the financial markets. INPUT: search prompt.
WEATHER - provides per-location weather forecast for the next 5 days, at per-day granularity. INPUT: City, Country/State.

Example:

<yair1xigoresponse>{ "TOOL" : "SEARCH", "TOOL_INPUT" : "WHo is the UK PM?" }</yair1xigoresponse>
<yair1xigoresponse>{ "TOOL" : "WEATHER", "TOOL_INPUT" : "Tel Aviv, Israel" }</yair1xigoresponse>

IMPORTANT: Use these exact formats and never deviate.
Do not invoke a tool if it's already used or if required input is missing or vague.

When providing your final reply, ALWAYS wrap the answer in <yair1xigoresponse> tags and use the following format:
<yair1xigoresponse>{ "ANSWER" : "Your answer" }</yair1xigoresponse>
IMPORTANT: Use this exact format and never deviate.

Today's date is ${new Date(Date.now()).toDateString()}.
Consider your knowledge as valid until September 2021. If a request has no time context, assume current time. Do not mention tools directly to the user.

Follow these steps:
1. Identify the human's most recent message.
2. If latest message is part of a user request, create a self-contained question, including relevant data from chat and tool invocations.
3. State the most appropriate tool and input, listing prerequisites and how they are met.
4. Provide the tool invocation request or answer in JSON format wrapped within <yair1xigoresponse> tags: <yair1xigoresponse>RESPONSE</yair1xigoresponse>.

Example response:
</yair1xigoresponse>{ "ANSWER" : "Your answer" }</yair1xigoresponse>

Your reply is to the human's most recent message. Do not invoke a tool if the required information was already provided by a previous tool invocation.
`
};

  const prepMessageStable = { role : 'user', content : `You are Robot 1-X (R1X), a helpful assistant developed by the Planet Express team and integrated into a ${messenger} chat. You are based on ${gptVer} technology. More information about you is available at https://r1x.ai.

I will provide you with a chat between R1X and a human; the chat will be wrapped with tags, as such: <yair1xigor>CHAT</yair1xigor>. Last speaker is the user.
I will also provide you with data generated by previous tool invocations, which you can rely on for your answers; this data will be wrapped with tags, as such: <r1xdata>DATA</r1xdata>.

IMPORTANT: Before invoking a tool or providing an answer, follow these steps:
1. CHECK IF DATA FROM A TOOL IS ALREADY PROVIDED TO YOU in the <r1xdata> tag.
2. If data is provided in the <r1xdata> tag, DO NOT invoke the tool again.
3. Instead, use the provided data to create an appropriate answer to the user's request.

DO NOT CONTRADICT THAT DATA AND DO NOT DOUBT THAT DATA. THAT DATA SUPERSEDES ANY OTHER DATA YOU ARE AWARE OF.
DO NOT MENTION TO THE USER THIS DATA WAS RETURNED BY A SEARCH TOOL OR PROVIDED TO YOU IN ANY WAY.
DO NOT PROVIDE THE TOOL INVOCATION RESPONSE LINE IN YOUR REPLY.

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
Try to be verbose in your answers; if you have missing data and ONLY if you cannot use the tools provided to fetch it, try to estimate; in these cases, let the user know your answer is an estimate.
Finally, do not invoke a tool if the required information was already provided by a previous tool invocation, whose data is provided to you.


Don't provide your response until you made sure it is valid, and meets all prerequisites laid out for tool invocation.

WHEN PROVIDING A FINAL ANSWER TO THE USER, NEVER MENTION THE SEARCH AND WEATHER TOOLS DIRECTLY, AND DO NOT SUGGEST THAT THE USER UTILIZES THEM.

Your tasks are as follows:

1. Formulate the request from the human in their last message.
2. Formulate the human's request as a self-contained question, including all relevant data from previous messages in the chat, as well as data from tool invocations.
3. State which tool should be invoked can provide the most information, and with what input. List all prerequisites for the tool and show how each is met. IMPORTANT: it is not allowed to invoke a tool that already has data provided to in in the <r1xdata> section.
4. Formulate the tool invocation request, or answer, in JSON format as detailed above. JSON should be delimited as <yair1xigoresponse>RESPONSE</yair1xigoresponse>. IMPORTANT: THE "RESPONSE" PART MUST BE DELIVERED IN A SINGLE LINE. DO NOT USE MULTILINE SYNTAX.

Use the following format when provicing your answer:

Human's most recent message: <request>
Self-contained request: <human's most recent request, including all relevant data from chat history>
Tool invocation request: <information about which tool is most relevant, if any, including explanation how each prerequisite for the tool is met with detailed data. confirm that you have verified that this tool has not been invoked yet, as it is illegal to invoke again>
Response: <yair1xigoresponse><tool request or answer in JSON format></yair1xigoresponse>

IMPORTANT: Make sure to focus on the most recent request from the user, even if it is a repeated one.
`
};

  //return ctx.userChannel == 'canary' ? prepMessageCanary : prepMessageStable;
  return prepMessageStable;
}

const prepReplyMessage = { role : 'assistant', content : `Understood. Please provide me with the chat between R1X and the human.` };

async function getChatCompletionWithTools(ctx, messengerName, messages, direct) {
  try {
    ctx.log(`Starting getChatCompletionWithTools.`);

    //const parsedMessages = deepClone(messages);
    const parsedMessages = direct ? await deepClone(messages) : await dbMessages2Messages(messages);
    //fs.writeFileSync('repro.json', JSON.stringify( {messages : parsedMessages} ), null, 2);
    ctx.log({ messages: parsedMessages});
      
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
        prevResponses.push(`INVOKED TOOL=${tool}, TOOL_INPUT=${input}, ACCURACY=100%, INVOCATION DATE=${new Date(Date.now()).toDateString()} RESPONSE=${response}`);
      }
    }
  } catch (e) {
    ctx.log({e});  
  }

  ctx.log(`getChatCompletionWithTools: failed generating customized reply, falling back to getChatCompletion.`);

  return getChatCompletion(ctx, messengerName, messages);
}

function escapeSpecialChars(str) {
  return str.replace(/[\n\r\t\b\f/]/g, function(match) {
    switch(match) {
      case '\n': return '\\n';
      case '\r': return '\\r';
      case '\t': return '\\t';
      case '\b': return '\\b';
      case '\f': return '\\f';
      case '\\': return '\\\\';
      case '\'': return '\\\'';
      case '\"': return '\\"';
      default: return match;
    }
  });
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
here is the data so far:
    
<r1xdata>${prevResponses.join('\n')}</r1xdata>
`;
  };

  const prepMessage = await getPrepMessage(ctx, messengerName);
  messages.push(prepMessage);
  messages.push(prepReplyMessage);

  messages.push(newRequest);

  ctx.log({messages});

  const reply = await getChatCompletionCore(ctx, messengerName, messages);

  const regex = /<yair1xigoresponse>(.*?)<\/yair1xigoresponse>/s;
  const matches = regex.exec(reply.response);

  if (! matches) {
      return 0;
  }
  
  const escapedMatch = escapeSpecialChars(matches[1]);
  //fs.writeFileSync('response_matches.json', escapedMatch, null, 2);
  ctx.log(`completionIterativeStep: matched response: ${escapedMatch}`);
  
  const jsonReply = JSON.parse(escapedMatch);

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
