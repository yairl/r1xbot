"use strict"
const logger = require("../../utils/logger");
const downloader = require("../../utils/download-services");
const mediaConverter = require("../../utils/media-converters");
const fileServices = require("../../utils/file-services");
const { insertMessage } = require("../messages/messages-service");

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
  fileId];
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
    const message = { message: response.data.result };
    // TODO ishumsky - fileId is outside until added to the DB.
    const [parsedMessage, fileId] = parseMessage(message);
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

async function getVoiceMp3File(ctx, tmpFolderBase, fileId) {
  const tmpFolder = tmpFolderBase + 'tg/';
  const url = await getDownloadUrl(ctx, fileId);
  const [oggFilePath, mp3FilePath] = getAudioFilePaths(ctx, tmpFolder, fileId);
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
    logger.info(`[${ctx}] getDownloadUrl failed. response=`, response);
  }

  const remoteFilePath = response.data.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${remoteFilePath}`;

  logger.info(`[${ctx}] getDownloadUrl: downloadUrl=${downloadUrl}`);
  return downloadUrl;
}

function getAudioFilePaths(ctx, tmpFolder, fileId) {
  const oggFilePath = tmpFolder + fileId + `.ogg`;
  const mp3FilePath = tmpFolder + fileId + `.mp3`;

  logger.info(`[${ctx}] getAudioFilePaths: oggFilePath=${oggFilePath}, mp3FilePath=${mp3FilePath}`);
  return [oggFilePath, mp3FilePath];
}

module.exports = {
  parseMessage,
  sendMessage,
  isMessageForMe,
  getVoiceMp3File
};
