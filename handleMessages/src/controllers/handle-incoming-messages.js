const { getChatCompletion } = require("../services/open-ai/query-openai");
const db = require("../db/models");
const ms = require("../services/messages/messages-service");
const messengers = require("../services/messengers");

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
    const parsedMessage = messenger.parseMessage(parsedEvent.event);

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
  introMessageLegal = `Robot 1-X at your service!

First, be aware that while I always do my best to help, I am not a professional doctor, psychologist or banker.
Always check my suggestions with a professional.

If you're under 13, ask your parents for permission before you continue talking to me!

And of course, read my privacy policy at https://r1x.ai/privacy.`

  introMessageOverview = `Phew, now that that's out of the way, here are some things you can ask me for:

- Write a bedtime story about Abigail and Jonathan, two superheroes who live next to a river.
- Plan a 14-day road trip from Milan to Minsk. Include detailed suggestions about where to spend each day.
- Rewrite the following text with spell-checking and punctuation: pleez send me all the docooments that is need for tomorrow flight im waiting for dem.
- Please summarize the following text: <copy some text/email here>.`

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

module.exports = {
  handleIncomingMessage
};
