"use strict"
const { getChatCompletion, createTranscription } = require("../services/open-ai/query-openai");
const db = require("../db/models");
const ms = require("../services/messages/messages-service");
const messengers = require("../services/messengers");
const fileServices = require("../utils/file-services");

// Handle incoming message from ingress SQS queue.
//
// 1. Insert message to DB.
// 2. Get chat history; send an intro message if this is a new chat.
// 3. Generate reply (chat completion, image generation, audio transcript).
// 4. Send reply to user.

async function handleIncomingMessage(ctx, event) {
  try {
    // 1. Parse message and insert to database
    const parsedEvent = JSON.parse(event);
    const messenger = messengers[parsedEvent.source];
    // TODO ishumsky - fileInfo is outside until added to the DB
    const [parsedMessage, fileInfo] = messenger.parseMessage(parsedEvent.event);

    // 2. If this is a voice message, then transcribe it
    if (parsedMessage.kind == 'voice') {
      messenger.setTyping(parsedMessage.chatId);
      
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
    messenger.setTyping(parsedMessage.chatId);

    const messageHistory = await ms.getMessageHistory(ctx, message);
    ctx.log('message history pulled.');

    if (messageHistory.length <= 1) {
      ctx.log('sending intro message.');
      await sendIntroMessage(ctx, messenger, parsedMessage);
      return ;
    }  

    // 3. Generate reply
    messenger.setTyping(parsedMessage.chatId);

    ctx.log('calling getChatCompletion...');
    const replyMessage = await getChatCompletion(ctx, messageHistory);
    ctx.log('getChatCompletion done, result is ', { replyMessage });

    // 4. Send reply to user
    await messenger.sendMessage(ctx, {
      chatId: parsedMessage.chatId,
      kind: "text",
      body: replyMessage
    });
    return `replied: ${replyMessage}`;
  } catch (error) {
    ctx.log('Message processing failed: ', error.stack);
    throw new Error(`Message processing failed.`);
  }
}

async function sendIntroMessage(ctx, messenger, parsedMessage) {
  const introMessageLegal = `Robot 1-X at your service!

First, be aware that while I always do my best to help, I am not a professional doctor, psychologist or banker.
Always check my suggestions with a professional.

If you're under 13, ask your parents for permission before you continue talking to me!

And of course, read my privacy policy at https://r1x.ai/privacy.`

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
  const tmpFolderBase = './tmp';
  let mp3FilePath = undefined;
  try {
    mp3FilePath = await messenger.getVoiceMp3File(ctx, tmpFolderBase, parsedMessage, fileInfo);
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
