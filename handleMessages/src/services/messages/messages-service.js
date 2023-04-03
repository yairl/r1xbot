const { Message } = require("../../db/models");

async function insertMessage(attributes) {
  const {
    source,
    messageTimestamp,
    chatId,
    senderId,
    messageId,
    kind,
    additionalData,
    rawSource
  } = attributes;

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
    messageId,
    kind,
    additionalData,
    rawSource
  });
  return message;
}

// async function getMessageHistory(chatId, messageId, options = {}) {
//   const

// }

module.exports = {
  insertMessage
};
