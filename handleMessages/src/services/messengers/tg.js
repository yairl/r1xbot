function parseMessage(message) {
  message = message.message;

  const source = "tg";
  const messageTimestamp = message.date * 1e3;
  const chatId = message.chat.id.toString();
  const senderId = message.from.id.toString();
  const senderIsMe = (message.from.id == process.env.TELEGRAM_SENDER_ID);
  const messageId = message.message_id.toString();
  const kind = "text";
  const body = message.text;

  return {
    source,
    messageTimestamp,
    chatId,
    senderId,
    senderIsMe,
    messageId,
    kind,
    body,
    rawSource: message
  };
}

async function sendMessage(attributes) {
  const {
    chatId,
    quoteId,
    kind,
    body
  } = attributes;

  if (kind != 'text') {
    return ;
  }

  const axios = require('axios');

  var args = { chat_id : chatId, text : body };
  if (quoteId) {
      args.reply_to_message_id = quoteId;
  }

  const response = await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, args);
  //console.log(response);
}


module.exports = {
    parseMessage,
    sendMessage
};

