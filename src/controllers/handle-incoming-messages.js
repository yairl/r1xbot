"use strict"
const { getChatCompletion, getChatCompletionWithTools, createTranscription } = require("../services/open-ai/query-openai");
const db = require("../db/models");
const ms = require("../services/messages/messages-service");
const messengers = require("../services/messengers");
const fileServices = require("../utils/file-services");

const { PostHog } = require('posthog-node');

const posthog_client = new PostHog(
    process.env.POSTHOG_API_KEY,
    { host: 'https://app.posthog.com' }
  );

// Handle incoming message from ingress SQS queue.
//
// 1. Insert message to DB.
// 2. Get chat history; send an intro message if this is a new chat.
// 3. Generate reply (chat completion, image generation, audio transcript).
// 4. Send reply to user.

async function handleIncomingMessage(ctx, event) {
  let inFlight = { working : true };

  try {
    await handleIncomingMessageCore(ctx, event, inFlight);
  } catch (error) {
    ctx.log('Message processing failed: ', error.stack);
    throw new Error(`Message processing failed.`);
  } finally {
    inFlight.working = false;
  }
}

async function handleIncomingMessageCore(ctx, event, inFlight) {
  // 1. Parse message and insert to database
  const parsedEvent = JSON.parse(event);
  const messenger = messengers[parsedEvent.source];

  // TODO igors - need a better mechanism to split the DB info an non-DB info
  const parseMessageResult = messenger.parseMessage(parsedEvent.event);

  if (parseMessageResult == undefined) {
    return;
  }

  const [parsedMessage, fileInfo] = parseMessageResult;

  messenger.setStatusRead(ctx, parsedMessage.messageId);

  let isTyping = false;

  // 2. If this is a voice message, then transcribe it
  if (parsedMessage.kind == 'voice') {
    messenger.setTyping(parsedMessage.chatId, inFlight);
    isTyping = true;
      
    parsedMessage.body = await getTranscript(ctx, messenger, parsedMessage, fileInfo);
      
    const [quoteTranscription, unused_replyToVoiceMessage] = getVoiceMessageActions(messenger.isMessageForMe(parsedMessage));
      
    if (quoteTranscription) {
      const prefixText = '\u{1F5E3}\u{1F4DD}: '; // these are emojis 🗣️📝 (just copy paste to normal windows to see)
      await messenger.sendMessageRaw(ctx, {
        chatId: parsedMessage.chatId,
        kind: "text",
        body: prefixText + parsedMessage.body,
        quoteId: parsedMessage.messageId,
      });
    }
    posthog_client.capture({
      distinctId: `${parsedEvent.source}:${parsedMessage.chatId}`,
      event: 'message-transcribed',
      properties: {
        senderId: parsedMessage.senderId,
        lengthInSeconds: -1
      }
    });
  }

  const message = await ms.insertMessage(ctx, parsedMessage);

  // If this is a callback notifying us of a message we sent, we're done processing and can exit.
  if (message.isSentByMe || message.body == null) {
    return;
  }

  // If this is a group chat, only reply if it's direct at us.
  if (!messenger.isMessageForMe(message)) {
    return;
  }

  // 2. Get chat history, and send an intro message.
  if (! isTyping) {
    messenger.setTyping(parsedMessage.chatId, inFlight);
    isTyping = true;
  }

  const messageHistory = await ms.getMessageHistory(ctx, message);
  ctx.log('message history pulled.');

  if (messageHistory.length <= 1) {
    ctx.log('sending intro message.');
    await sendIntroMessage(ctx, messenger, parsedMessage);
    return ;
  }  

  // 3. Generate reply
  ctx.log('calling getChatCompletion...');
  const messengerName = parsedEvent.source == 'wa' ? 'WhatsApp' : 'Telegram';
  const completion = await getChatCompletionWithTools(ctx, messengerName, messageHistory);
  ctx.log('getChatCompletion done, result is ', completion.response);

  // 4. Send reply to user

  await messenger.sendMessage(ctx, {
    chatId: parsedMessage.chatId,
    kind: "text",
    body: completion.response
  });

  posthog_client.capture({
    distinctId: `${parsedEvent.source}:${parsedMessage.chatId}`,
    event: 'reply-sent',
    properties: {
      senderId: parsedMessage.senderId,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      totalTokens: completion.promptTokens + completion.completionTokens
    }
  });
}

async function sendIntroMessage(ctx, messenger, parsedMessage) {
  const introMessageLegal = `Robot 1-X at your service!

First, be aware that while I always do my best to help, I am not a professional doctor, psychologist, banker or otherwise.
Some of my replies may provide incorrect information about people, locations and events.
Always check my suggestions with a professional.

If you're under 18, you must have your parents' permission before you continue talking to me!

Chatting with me means you agree to my Terms of Use (https://r1x.ai/terms-of-use) and Privacy policy (https://r1x.ai/privacy).
Make sure to read them before continuing this chat.`

  const introMessageOverview = `Phew, now that that's out of the way, here are some things you can ask me for:

- Write a bedtime story about Abigail and Jonathan, two superheroes who live next to a river.
- Plan a 14-day road trip from Milan to Minsk. Include detailed suggestions about where to spend each day.
- Rewrite the following text with spell-checking and punctuation: pleez send me all the docooments that is need for tomorrow flight im waiting for dem.
- Please summarize the following text: <copy some text/email here>.

And, you can send me an audio message instead of typing!

How can I help?`

  await messenger.sendMessage(ctx, {
    chatId: parsedMessage.chatId,
    kind: "text",
    body: introMessageLegal
  });

  await messenger.sendMessage(ctx, {
    chatId: parsedMessage.chatId,
    kind: "text",
    body: introMessageOverview
  });
}

async function getTranscript(ctx, messenger, parsedMessage, fileInfo) {
  let mp3FilePath = undefined;
  try {
    mp3FilePath = await messenger.getVoiceMp3File(ctx, parsedMessage, fileInfo);
    const transcription = await createTranscription(ctx, mp3FilePath);

    return transcription;

  } finally {
    // this code assumes that if mp3FilePath is defined, then it exists, and should be deleted no matter what
    if (mp3FilePath) {
      fileServices.deleteFile(ctx, mp3FilePath);
    }
  }
}

function getVoiceMessageActions(isMessageToMe) {
  // quote transcription only in group chats
  const quoteTranscription = true;
  const unused_replyToVoiceMessage = undefined;
  return [quoteTranscription, unused_replyToVoiceMessage];
}

module.exports = {
  handleIncomingMessage
};
