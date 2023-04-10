"use strict";
const logger = require("../utils/logger");
const fs = require('fs');
const pathLib = require('path');
const axios = require("axios");

async function downloadStreamFile(ctx, url, path) {
  // Create the directory if it doesn't exist
  const dirPath = pathLib.dirname(path);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  let isSuccessful = false; // Variable to track download status

  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream'
  });

  response.data.pipe(fs.createWriteStream(path));

  return new Promise((resolve, reject) => {
    response.data.on('end', () => {
      logger.info(`[${ctx}] downloadFile succeeded`);
      isSuccessful = true;
      resolve();
    });

    response.data.on('error', (err) => {
      reject(err);
    });
  }).then(() => {
    return isSuccessful; // Return the download status outside the callbacks
  });
}

module.exports = {
    downloadStreamFile,
};