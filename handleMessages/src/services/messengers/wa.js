function parseMessage(message) {
  const source = "wa";
  const messageTimestamp = message.data.time * 1e3;
  const chatId = message.data.from;
  const senderId =
    message.data.author == "" ? message.data.from : message.data.author;
  const senderIsMe = message.data.fromMe;
  const messageId = message.data.id;
  const kind = "text";
  const body = message.data.body;

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

  var args = { token : process.env.WHATSAPP_TOKEN, to : chatId, body : body };
  
  if (quoteId) {
      args.msgId = quoteId;
  }

  const response = await axios.post(`https://api.ultramsg.com/instance${process.env.WHATSAPP_INSTANCE}/messages/chat`, args);
  //console.log(response);
}

module.exports = {
  parseMessage,
  sendMessage
};

