"use strict";
const logger = require("../utils/logger");
const fs = require('fs');

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

function fileExists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
    deleteFile,
    fileExists
};