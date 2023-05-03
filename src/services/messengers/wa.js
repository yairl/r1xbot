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
    //case 'audio': return (value.audio.voice) ? MessageKindE.VOICE : MessageKindE.AUDIO;
    case 'audio': return MessageKindE.VOICE;
    default: return value.type; // just lazy, as all other texts match.
  }
}

function parseMessage(message) {
  const source = "wa";

  const eventKind = getEventKind(message.entry[0].changes[0].value);
  if (eventKind != EventKindE.MESSAGE) {
    return undefined;
  }

  const kind = getMessageKind(message.entry[0].changes[0].value.messages[0]);

  // User messages that come from WA have int timestamp in [sec]
  // WA doesn't generate an event for our reply messages, so need to generate manually.
  // For manually generated timestamps we use date.now() which responds with [ms] as int.
  // To keep the accuracy, and get the same [sec] units we do date.now()/1000, and pass it as float.
  // So here, parseFloat works both for WA int timestamps and our float timestamps.
  const messageTimestamp = parseFloat(message.entry[0].changes[0].value.messages[0].timestamp)* 1e3;
  const senderId = message.entry[0].changes[0].value.messages[0].from;

  // TODO igors - the current code assumes responses to chatID (the TG approach)
  // in WA the response is to a phone number.
  // WA has a chatId at    message.entry[0].id  but it seems to be meaningless.
  // so for now, have chatId carry the person to respond to
  const chatId = senderId;

  // WhatsApp Business API does not allow for group chats.
  const chatType = "private";
  const isSentByMe = senderId == process.env.WHATSAPP_PHONE_NUMBER;
  const messageId = message.entry[0].changes[0].value.messages[0].id;
  const replyToMessageId = message.entry[0].changes[0].value.messages[0].hasOwnProperty('context') ?
    message.entry[0].changes[0].value.messages[0].context.id:
    undefined;
  
  const body = (kind == MessageKindE.TEXT) ? message.entry[0].changes[0].value.messages[0].text.body : undefined;
  const fileId = (kind == MessageKindE.VOICE) ? message.entry[0].changes[0].value.messages[0].audio.id : undefined;
  const fileUniqueId = undefined;

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
    fileId,
    fileUniqueId
  }];
}

function getBotGeneratedMessage(ctx, sendMessageResponse, attributes) {
  // This represents a skeleton of the message that would be received by a webhook on the client side
  // if the cline would be running a webhook.
  const { chatId, quoteId, kind, body } = attributes;
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
                  "id": sendMessageResponse.data.messages[0].id,
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

  return message;
}

async function sendMessage(ctx, attributes) {
  const { chatId, quoteId, kind, body } = attributes;
  const response = await sendMessageRaw(ctx, attributes);

  if (response.hasOwnProperty('data')) {
    // for now (text messages) the existance of data should be enough to indicate success.
    // WA doesn't return a message struct that is received by the client, so no info to use to call parse message.
    // for now, just build a fake message
    const message = getBotGeneratedMessage(ctx, response, attributes);

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

  if (body.length > 4000) { body = body.substring(0, 4000); }

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

  let response;
  try {
     response = await axios.post(
      `https://graph.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      args,
      {headers}
    );
  } catch (error) {
    ctx.log(`sendMessageRaw: exception. error.response.data=${error?.response?.data}`);
    if (error?.response?.data) {
      ctx.log(JSON.stringify(error?.response?.data));
    }
    throw(error);
  }
  //ctx.log(response);
  
  return response;
}

function isMessageForMe(msg) {
  if (msg.chatType == "private") {
    return true;
  }

  return false;
}

async function getVoiceMp3File(ctx, parsedMessage, fileInfo) {
  ctx.log(`getVoiceMp3File: ${parsedMessage}, ${fileInfo}`);
  const url = await getDownloadUrl(ctx, fileInfo.fileId);
  const [oggFilePath, mp3FilePath] = getAudioFilePaths(ctx, parsedMessage.chatId, fileInfo);
  let isDownloadSuccessful = false;
  try {
    const headers = {
      Authorization: `Bearer ${process.env.WHATSAPP_BOT_TOKEN}`,
    };

    isDownloadSuccessful = await downloader.downloadStreamFile(ctx, url, oggFilePath, headers);
    await mediaConverter.convertOggToMp3(ctx, oggFilePath, mp3FilePath);

    return mp3FilePath;
    
  } finally {
    // we should delete the Ogg file no matter what happened, as long as it exists.
    const deleteOggFile = isDownloadSuccessful || fileServices.fileExists(oggFilePath);
    if (deleteOggFile) {
      fileServices.deleteFile(ctx, oggFilePath);
    }
  }
}

async function getDownloadUrl(ctx, fileId) {
  ctx.log(`getDownloadUrl: ${fileId}`);
  const headers = {
    Authorization: `Bearer ${process.env.WHATSAPP_BOT_TOKEN}`,
  };

  let response;
  try {
    response = await axios.get(
      `https://graph.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION}/${fileId}?phone_number_id=${process.env.WHATSAPP_PHONE_NUMBER_ID}`,
      {headers}
    );
  } catch (error) {
    ctx.log(`getDownloadUrl: exception. error.response.data=${error?.response?.data}`);
    throw(error);
  }

  if (response.hasOwnProperty("error")) {
    ctx.log('getDownloadUrl failed. response=', response);
  }

  ctx.log(`getDownloadUrl: response=${response}`);
  // from now on assume it has succeeeded.

  const downloadUrl = response.data.url;

  ctx.log(`getDownloadUrl: downloadUrl=${downloadUrl}`);
  return downloadUrl;
}

function getAudioFilePaths(ctx, chatId, fileInfo) {
  const tempDirPath = fileServices.makeTempDirName(`r1x/wa/${chatId}_`);
  const filePathName = tempDirPath + '/audio';
  const oggFilePath = filePathName + '.ogg';
  const mp3FilePath = filePathName + '.mp3';

  ctx.log(`getAudioFilePaths: oggFilePath=${oggFilePath}, mp3FilePath=${mp3FilePath}`);
  return [oggFilePath, mp3FilePath];
}


function setTyping(chatId, inFlight) {
  // TODO igors - can't find WA API for typing indication.
  return;
}

async function setStatusRead(ctx, messageId) {
  ctx.log(`setStatusRead`);
  const headers = {
    Authorization: `Bearer ${process.env.WHATSAPP_BOT_TOKEN}`,
    'Content-Type': 'application/json',
  };

  var args = {
    messaging_product: "whatsapp",
    status: "read",
    message_id: messageId,
  };

  let response;
  try {
    response = await axios.post(
      `https://graph.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      args,
      {headers}
    );
  } catch (error) {
    ctx.log(`setStatusRead: exception. error.response.data=${error?.response?.data}`);
    return ;
  }

  if (response?.data?.success != true) {
    ctx.log(`setStatusRead: response is wrong. Compared field ${response?.data?.success}. Full response ${response}`);
  }
}

module.exports = {
  parseMessage,
  sendMessage,
  sendMessageRaw,
  isMessageForMe,
  setTyping,
  getVoiceMp3File,
  setStatusRead
};
