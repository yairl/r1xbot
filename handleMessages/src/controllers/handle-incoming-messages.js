const { getChatCompletion } = require("../services/open-ai/query-openai");
const db = require("../db/models");
const { insertMessage } = require("../services/messages/messages-service");

// Handle incoming message from ingress SQS queue.
//
// 1. Insert message to DB.
// 2. Perform request (chat completion, image generation, audio transcript).
// 3. Send answer to chat.
// 4. Remove message from queue.

async function handleIncomingMessage(event) {
  try {
    const parsedEvent = parseSqsEvent(event);

    const message = await insertMessage(parsedEvent);
    //console.log(message.toJSON());

    //const chatResult = await getChatCompletion(eventData.messages);
    //console.log(chatResult);
  } catch (error) {
    console.log(error.stack);
  }
}

function parseSqsEvent(event) {
  const eventDataStringified = event.Records[0].body;

  parsedEvent = JSON.parse(eventDataStringified);

  switch (parsedEvent.source) {
    case "tg":
      return parseTelegramMessage(parsedEvent.event);
    case "wa":
      return parseWhatsappMessage(parsedEvent.event);
  }
}

function parseTelegramMessage(message) {
  message = message.message;

  const source = "tg";
  const messageTimestamp = message.date;
  const chatId = message.chat.id.toString();
  const senderId = message.from.id.toString();
  const messageId = message.message_id.toString();
  const kind = "text";
  const body = message.text;

  return {
    source,
    messageTimestamp,
    chatId,
    senderId,
    messageId,
    kind,
    body,
    rawSource: message
  };
}

function parseWhatsappMessage(message) {
  const source = "wa";
  const messageTimestamp = message.data.time;
  const chatId = message.data.from;
  const senderId =
    message.data.author == "" ? message.data.from : message.data.author;
  const messageId = message.data.id;
  const kind = "text";
  const body = message.data.body;

  return {
    source,
    messageTimestamp,
    chatId,
    senderId,
    messageId,
    kind,
    body,
    rawSource: message
  };
}

module.exports = {
  handleIncomingMessage
};
