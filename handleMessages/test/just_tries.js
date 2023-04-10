"use strict";
const assert = require('assert');
require("../src/utils/init-env-vars").config();
const logger = require("../src/utils/logger");
const fs = require('fs');
const ffmpeg = require("fluent-ffmpeg");
const axios = require("axios");
const pathLib = require('path');

const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai = new OpenAIApi(configuration);

async function getDownloadUrl(ctx, file_id) {
  const args = {"file_id": file_id};
  
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

function getAudioFilePaths(ctx, file_id) {
  const oggFilePath = `./tmp/${file_id}.ogg`;
  const mp3FilePath = `./tmp/${file_id}.mp3`;

  logger.info(`[${ctx}] getAudioFilePaths: oggFilePath=${oggFilePath}, mp3FilePath=${mp3FilePath}`);
  return [oggFilePath, mp3FilePath];
}

async function downloadFile(ctx, url, path) {
  // Create the directory if it doesn't exist
  const dirPath = pathLib.dirname(path);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream'
  });

  response.data.pipe(fs.createWriteStream(path));

  return new Promise((resolve, reject) => {
    response.data.on('end', () => {
      logger.info(`[${ctx}] downloadFile succeeded`);
      resolve();
    });

    response.data.on('error', (err) => {
      reject(err);
    });
  });
}

async function convertOggToMp3(ctx, oggFilePath, mp3FilePath) {
  return new Promise((resolve, reject) => {
    ffmpeg({
      source: oggFilePath,
    }).on("error", (err) => {
      reject(err);
    }).on("end", () => {
      logger.info(`[${ctx}] convertOggToMp3 succeeded`);
      resolve(mp3FilePath);
    }).save(mp3FilePath);
  });
}

async function createTranscription(ctx, mp3FilePath) {
  const transcription = await openai.createTranscription(  
    fs.createReadStream(mp3FilePath),
    process.env.OPENAI_SPEECH_TO_TEXT_MODEL,
  );

  console.log(transcription);

  logger.info(`[${ctx}] createTranscription transcription=${transcription.data.text}`);
  return transcription.data.text;
}

async function deleteFile(ctx, filePath) {
  logger.info(`[${ctx}] deleteFile filePath=${filePath}`);
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      logger.info(`[${ctx}] deleteFile succeeded`);
      resolve();
    });
  });
}

async function getTranscript(ctx, parsedEvent) {
  const file_id = parsedEvent.event.message.voice.file_id;
  const url = await getDownloadUrl(ctx, file_id);
  const [oggFilePath, mp3FilePath] = getAudioFilePaths(ctx, file_id);
  await downloadFile(ctx, url, oggFilePath);
  await convertOggToMp3(ctx, oggFilePath, mp3FilePath);
  const transcription = await createTranscription(ctx, mp3FilePath);
  deleteFile(ctx, oggFilePath);
  deleteFile(ctx, mp3FilePath);
  return transcription;//.data.text;
}

async function main() {
    const AUDIO_WEBHOOK_TG = '{"source":"tg","event":{"update_id":279089366,"message":{"message_id":835,"from":{"id":648183991,"is_bot":false,"first_name":"Igor","language_code":"en"},"chat":{"id":648183991,"first_name":"Igor","type":"private"},"date":1680981329,"voice":{"duration":1,"mime_type":"audio/ogg","file_id":"AwACAgQAAxkBAAIDQ2QxvVEjeuOy_y0B9po8m4pqoDp1AAKgEQACLdmRUcuxGB-fVV7XLwQ","file_unique_id":"AgADoBEAAi3ZkVE","file_size":5282}}}}';
    const parsedEvent = JSON.parse(AUDIO_WEBHOOK_TG);

    const ctx = 0;
    const transcript = await getTranscript(ctx, parsedEvent);
    logger.info(`[${ctx}] main: transcript=${transcript}`);
}

main();

