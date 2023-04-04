const { Message } = require("../../db/models");

async function insertMessage(attributes) {
  const {
    source,
    messageTimestamp,
    chatId,
    senderId,
    isSentByMe,
    messageId,
    replyToMessageId,
    kind,
    body,
    rawSource
  } = attributes;
  console.log({ attributes });

  // Yair: don't think this makes sense long term, probably has a way to do insert-if-new in one API call.
  const existingMessage = await Message.findOne({
    where: { chatId, messageId }
  });

  if (existingMessage !== null) {
    // TODO options to update?
    return existingMessage;
  }
  const message = await Message.create({
    source,
    messageTimestamp,
    chatId,
    senderId,
    isSentByMe,
    messageId,
    replyToMessageId,
    kind,
    body,
    rawSource
  });

  return message;
}

async function getMessageHistory(message, options = {}) {
  const { limit = 20 } = options;
  const { chatId, messageTimestamp } = message;
  const messages = await Message.findAll({
    where: { chatId },
    limit,
    order: ["messageTimestamp"]
  });
  return messages;
}

module.exports = {
  insertMessage,
  getMessageHistory
};
