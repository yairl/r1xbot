const { Chat: chatModel } = require("../../db/models");

async function addMessageToChat(attributes) {
  const {
    source,
    messageTimestamp,
    chatId,
    senderId,
    messageId,
    kind,
    additionalData
  } = attributes;
  console.log({ attributes });
  const message = await chatModel.create({
    source,
    messageTimestamp,
    chatId,
    senderId,
    messageId,
    kind,
    additionalData
  });
  return message;
}

module.exports = {
  addMessageToChat
};
