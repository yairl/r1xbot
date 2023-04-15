"use strict"
const downloader = require("../../utils/download-services");
const mediaConverter = require("../../utils/media-converters");
const fileServices = require("../../utils/file-services");
const { insertMessage } = require("../messages/messages-service");
const axios = require("axios");

class EventKindE {
  static STATUS_UPDATE = 'status_update';
  static MESSAGE = 'message';
}

class MessageKindE {
  static TEXT = 'text';
  static VOICE = 'voice'; // a voice recorded by the app
  static AUDIO = 'audio'; // a file attachement of type audio
  // there are many more kinds
}

function getEventKind(value) {
  if (value.hasOwnProperty('statuses')) return EventKindE.STATUS_UPDATE;
  if (value.hasOwnProperty('messages')) return EventKindE.MESSAGE;
  // shouldn't happen
  return undefined;
}

function getMessageKind(value) {
  switch(value.type) {
    case 'audio': return (value.audio.voice) ? MessageKindE.VOICE : MessageKindE.AUDIO;
    default: return value.type; // just lazy, as all other texts match.
  }
}



function parseMessage(message) {
  const source = "wa";
  let isSupported = false;

  const eventKind = getEventKind(message.entry[0].changes[0].value);
  if (eventKind!=EventKindE.MESSAGE) {
    return [{},{isSupported}]
  }

  const kind = getMessageKind(message.entry[0].changes[0].value.messages[0]);
  if (kind!=MessageKindE.TEXT) {
    return [{},{isSupported}]
  }

  const messageTimestamp = parseFloat(message.entry[0].changes[0].value.messages[0].timestamp)* 1e3;
  const senderId = message.entry[0].changes[0].value.messages[0].from;
  // TODO igors - the current code assumes responces to chatID (the TG approach)
  // in WA the response is to a phone number.
  // WA has a chatId at    message.entry[0].id  but it seems to be meaningless.
  // so for now, have chatId carry the person to respond to
  const chatId = senderId;
  // TODO igors - no support for groups yet
  //const chatType = chatId.endsWith("@g.us") ? "group" : "private";
  const chatType = "private";
  const isSentByMe = senderId == process.env.WHATSAPP_PHONE_NUMBER;
  const messageId = message.entry[0].changes[0].value.messages[0].id;
  const replyToMessageId = message.entry[0].changes[0].value.messages[0].hasOwnProperty('context') ?
    message.entry[0].changes[0].value.messages[0].context.id:
    undefined;
  
  const body = (kind == MessageKindE.TEXT) ? message.entry[0].changes[0].value.messages[0].text.body : undefined;
  const fileId = (kind == MessageKindE.VOICE) ? message.entry[0].changes[0].value.messages[0].audio.id : undefined;
  const fileUniqueId = undefined;

  isSupported = true;

  return [{
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
  }, {
    isSupported,
    fileId,
    fileUniqueId
  }];
}

async function sendMessage(ctx, attributes) {
  const { chatId, quoteId, kind, body } = attributes;
  const response = await sendMessageRaw(ctx, attributes);

  if (response.hasOwnProperty('data')) {
    // for now (text messages) the existance of data should be enough to indicate success.
    // WA doesn't return a message struct that is recieved by the client, so no info to use to call parse message.
    // for now, just build a fake message
    const message = {
      "entry": [
        {
          "changes": [
            {
              "value": {
                "messages": [
                  {
                    "timestamp": (Date.now()/1e3).toString(), // WA sends time in sec, so normalize to that
                    "from": process.env.WHATSAPP_PHONE_NUMBER.toString(),
                    "id": response.data.messages[0].id,
                    "type": kind,
                    "text": {
                      "body": body
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    // TODO ishumsky - fileInfo is outside until added to the DB.
    const [parsedMessage, fileInfo] = parseMessage(message);
    // TODO igors - because of the abuse of chatId, after parsing it'll have the value of our bot,
    // so DB lookups will not pick responses.
    // change back to the user phone number to correlate.
    parsedMessage.chatId = chatId;
    ctx.log({ parsedMessage });

    await insertMessage(ctx, parsedMessage);
    ctx.log(`Message inserted successfully: `, parsedMessage);

  }
}

async function sendMessageRaw(ctx, attributes) {
  const { chatId, quoteId, kind, body } = attributes;

  if (kind != "text") {
    return;
  }

  const headers = {
    Authorization: `Bearer ${process.env.WHATSAPP_BOT_TOKEN}`,
    'Content-Type': 'application/json'
  };

  var args = {
    messaging_product: "whatsapp",    
    recipient_type: "individual",
    to: chatId,
    type: "text",
    text: {
      preview_url: false,
      body: body
    }
  };

  if (quoteId) {
    args.context = {message_id: quoteId};
  }

  const response = await axios.post(
    `https://graph.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    args,
    {headers}
  );
  //ctx.log(response);
  
  return response;
}

function isMessageForMe(msg) {
  if (msg.chatType == "private") {
    return true;
  }

  return false;
}

function setTyping(chatId, inFlight) {
  // TODO igors - can't find WA API for typing indication.
  return;
}

module.exports = {
  parseMessage,
  sendMessage,
  sendMessageRaw,
  isMessageForMe,
  setTyping
};
