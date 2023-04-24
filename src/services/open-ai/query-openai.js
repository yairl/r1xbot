"use strict";
const fs = require('fs');
const { Configuration, OpenAIApi } = require("openai");
const { performance } = require('perf_hooks');

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

const prepMessage = { role : 'user', content : `For my next request, you can ask to invoke a Google search to augment your database before replying.
This is helpful for any request for up-to-date information, or data which you do not have.

At any case where such data may be helpful, please reply with the following format:

TOOL=SEARCH TOOL_INPUT=<search prompt>

DO NOT DEVIATE FROM THIS FORMAT, KEEPING ALL FORMATTING OPTIONS SUCH AS UPPERCASE/LOWERCASE, EXACT WORDS ETC EXACTLY THE SAME.

I will perform that search and provide you with the result in a separate message.
Otherwise, provide your answer.

IT IS CRITICAL THAT YOUR REPLY WILL ONLY USE THIS EXACT FORMAT, WITH NO OTHER CHARACTERS BEFORE OR AFTER IT.
TODAY IS April 24th, 2023, AND YOUR DATABASE ABOUT WORLD EVENTS CONTAINS EVENTS UNTIL 2020.
`
};

const prepReplyMessage = { role : 'assistant', content : `Understood! Please proceed with your request.` };

async function getChatCompletionGoogleData(ctx, messengerName, messages) {
  const parsedMessages = deepClone(messages);

  const askPrompt = `Provide a Google search prompt that will provide relevant information for the following request:

REQUEST: ${parsedMessages[parsedMessages.length - 1].content}

ONLY PROVIDE THE PROMPT, WITH NO EXTRA COMMENTS, PREFIXES OR SUFFIXES.`

  parsedMessages[parsedMessages.length - 1].content = askPrompt;

  const searchPrompt = await getChatCompletionCore(ctx, messengerName, parsedMessages);
  console.log(`Requested search prompt=${searchPrompt.response}`);

  const { Serper } = require('langchain/tools');
  const serper = new Serper();

  const answer = await serper.call(searchPrompt.response);

  return { prompt : searchPrompt.response, answer: answer };
}

async function getChatCompletionWithSearchResult(ctx, messengerName, messages, googleData) {
  const parsedMessages = deepClone(messages);
  const askPrompt = `R1X just performed a Google search with the prompt "${googleData.prompt}", and got this answer: ${googleData.answer}.

ASSUME THIS DATA IS CORRECT AND UP-TO-DATE.
DO NOT CONTRADICT IT AND DO NOT DOUBT IT.
IT SUPERSEDES ANY OTHER DATA IN YOUR DATABASE.
IN YOUR REPLY, DO NOT MENTION ANY CONTRADICTION BETWEEN THIS DATA AND OTHER DATA YOU HAVE.
THE DATA PROVIDED BY THE GOOGLE SEARCH IS ACCURATE AS OF 2023.
THE DATA IN THE R1X DATABASE IS ACCURATE AS OF 2020, AND IS THEREFORE OUT OF DATE.
IN CASE OF ANY CONFLICT BETWEEN THE TWO, THE DATA PROVIDED BY THE GOOGLE SEARCH OVERRIDES THE DATA IN R1X DATABASES.

Please reply to the following message: ${parsedMessages[parsedMessages.length - 1].content}`;

  parsedMessages[parsedMessages.length - 1].content = askPrompt;

  const answer = await getChatCompletionCore(ctx, messengerName, parsedMessages);

  console.log({answer});

  return answer; 
}


async function getChatCompletionWithTools(ctx, messengerName, messages) {
  ctx.log(`Starting getChatCompletionWithTools.`);

  const parsedMessages = await dbMessages2Messages(messages);

  const googleData = await getChatCompletionGoogleData(ctx, messengerName, parsedMessages);
  const answer = await getChatCompletionWithSearchResult(ctx, messengerName, parsedMessages, googleData);

  return answer;

  //const parsedMessages = deepClone(messages);
  //const parsedMessages = await dbMessages2Messages(messages);

  const prevResponses = [];
  const ask = parsedMessages[parsedMessages.length - 1];
  const history = parsedMessages.slice(0, -1);

  const googleSearchHistory = deepClone(history);
  generateChatCompletion();

  for (let i = 0; i < 2; i++) {
    ctx.log(`Invoking completionIterativeStep #${i} ASK=${ask}`);
    const { answer, tool, input } = await completionIterativeStep(ctx, deepClone(history), ask, prevResponses);
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

  let newRequest = { role : 'user', content : '' };
  if (prevResponses.length > 0) {
    newRequest.content += `\n\nPrevious search invocation and its response:\n${prevResponses.join('\n')}`;
    newRequest.content += `\nTHIS DATA IS MORE UP TO DATE THAN DATA IN YOUR DATABASE, AND SUPERSEDES IT.\n`;
  };

  messages[messages.length - 1].content += newRequest.content;
  messages[messages.length - 1].content += ask.content;
//  messages.push(newRequest);

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

/*
ALWAYS FETCH DATA FROM A TOOL IF IT CAN HELP GENERATE A MORE ACCURATE RESULT.
DO NOT DEVIATE FROM TOOL-PROVIDED INFORMATION IN ANY MANNER.
ALWAYS RELY ON IT, AND NEVER CONTRADICT IT - EVEN IF YOUR INTERNAL DATABASE INDICATES OTHERWISE.
NEVER INFORM USER TOOL-PROVIDED INFORMATION MAY BE INCORRECT.
DO NOT MENTION DATA WAS PROVIDED BY TOOL IN ANY MANNER.
*/

module.exports = {
  getChatCompletion,
  getChatCompletionWithTools,
  createTranscription
};
