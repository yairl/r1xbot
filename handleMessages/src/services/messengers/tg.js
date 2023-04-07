const logger = require("../../utils/logger");
const { insertMessage } = require("../messages/messages-service");

function parseMessage(message) {
  message = message.message;

  const source = "tg";
  const messageTimestamp = message.date * 1e3;
  const chatType = message.chat.type;
  const chatId = message.chat.id.toString();
  const senderId = message.from.id.toString();
  const isSentByMe = message.from.id == process.env.TELEGRAM_SENDER_ID;
  const messageId = message.message_id.toString();
  const replyToMessageId =
    "reply_to_message" in message
      ? message.reply_to_message.message_id
      : undefined;
  const kind = "text";
  const body = message.text;

  return {
    source,
    messageTimestamp,
    chatType,
    chatId,
    senderId,
    isSentByMe,
    messageId,
    replyToMessageId,
    kind,
    body,
    rawSource: message
  };
}

async function sendMessage(ctx, attributes) {
  const { chatId, quoteId, kind, body } = attributes;

  if (kind != "text") {
    return;
  }

  const axios = require("axios");

  var args = { chat_id: chatId, text: body };
  if (quoteId) {
    args.reply_to_message_id = quoteId;
  }

  const response = await axios.post(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    args
  );
  //logger.info(`[${ctx}] `, response);

  if (response.data.ok) {
    message = { message: response.data.result };
    parsedMessage = parseMessage(message);
    logger.info(`[${ctx}] `, { parsedMessage });

    await insertMessage(ctx, parsedMessage);
    logger.info(`[${ctx}] Sent message inserted successfully: `, parsedMessage);
  }
}

function isMessageForMe(msg) {
  if (msg.chatType == "private") {
    return true;
  }

  if (msg.body.startsWith(`@${process.env.TELEGRAM_BOT_NAME}`)) {
    return true;
  }

  return false;
}

module.exports = {
  parseMessage,
  sendMessage,
  isMessageForMe
};
