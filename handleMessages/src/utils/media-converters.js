"use strict";
const logger = require("../utils/logger");
const ffmpeg = require("fluent-ffmpeg");

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
  
module.exports = {
  convertOggToMp3,
};  