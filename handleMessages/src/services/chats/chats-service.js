const { Chat } = require("../../db/models");

async function addMessageToChat(attributes) {
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

  const existingMessage = await Chat.findOne({
    where: { chatId, messageId }
  });
  if (existingMessage !== null) {
    // TODO options to update?
    return existingMessage;
  }
  const message = await Chat.create({
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
  addMessageToChat
};
