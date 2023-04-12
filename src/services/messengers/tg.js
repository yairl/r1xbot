"use strict"
const downloader = require("../../utils/download-services");
const mediaConverter = require("../../utils/media-converters");
const fileServices = require("../../utils/file-services");
const { insertMessage } = require("../messages/messages-service");
const axios = require("axios");

class MessageKindE {
  static TEXT = 'text';
  static VOICE = 'voice';
  static AUDIO = 'audio';
}


function getMessageKind(message) {
  if (message.hasOwnProperty('text')) return MessageKindE.TEXT;
  if (message.hasOwnProperty('voice')) return MessageKindE.VOICE;
  if (message.hasOwnProperty('audio')) return MessageKindE.AUDIO;
  // shouldn't happen
  return undefined;
}

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
  const kind = getMessageKind(message);
  const body = message.text;
  const fileId = (kind == MessageKindE.VOICE) ? message.voice.file_id : undefined;
  const fileUniqueId = (kind == MessageKindE.VOICE) ? message.voice.file_unique_id : undefined;

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
  },
  // TODO ishumsky - fileId is outside until added to the DB.
  {fileId, fileUniqueId}];
}

async function sendMessage(ctx, attributes) {
  const response = await sendMessageRaw(ctx, attributes);

  if (response.data.ok) {
    const message = { message: response.data.result };
    // TODO ishumsky - fileInfo is outside until added to the DB.
    const [parsedMessage, fileInfo] = parseMessage(message);
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

  var args = { chat_id: chatId, text: body };
  if (quoteId) {
    args.reply_to_message_id = quoteId;
    args.allow_sending_without_reply = true;
  }

  const response = await axios.post(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    args
  );
  //ctx.log(response);

  return response;
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

async function getVoiceMp3File(ctx, tmpFolderBase, parsedMessage, fileInfo) {
  const tmpFolder = tmpFolderBase + '/tg';
  const url = await getDownloadUrl(ctx, fileInfo.fileId);
  const [oggFilePath, mp3FilePath] = getAudioFilePaths(ctx, tmpFolder, parsedMessage.chatId, fileInfo);
  let isDownloadSuccessful = false;
  try {
    isDownloadSuccessful = await downloader.downloadStreamFile(ctx, url, oggFilePath);
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
  const axios = require("axios");
  
  const args = {"file_id": fileId};
  
  const response = await axios.post(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile`,
     args
  );

  if (response.data.ok == false) {
    ctx.log('getDownloadUrl failed. response=', response);
  }

  const remoteFilePath = response.data.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${remoteFilePath}`;

  ctx.log(`getDownloadUrl: downloadUrl=${downloadUrl}`);
  return downloadUrl;
}

function getAudioFilePaths(ctx, tmpFolder, chatId, fileInfo) {
  const filePathName = `${tmpFolder}/${chatId}_${fileInfo.fileUniqueId}_${fileInfo.fileId}`;
  const oggFilePath = filePathName + '.ogg';
  const mp3FilePath = filePathName + '.mp3';

  ctx.log(`getAudioFilePaths: oggFilePath=${oggFilePath}, mp3FilePath=${mp3FilePath}`);
  return [oggFilePath, mp3FilePath];
}

function setTyping(chat_id) {
  axios.post(
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendChatAction`,
    { chat_id : chat_id, action : 'typing' } 
  );
}

module.exports = {
  parseMessage,
  sendMessage,
  sendMessageRaw,
  isMessageForMe,
  setTyping,
  getVoiceMp3File
};
