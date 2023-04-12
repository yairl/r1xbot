"use strict";
const fs = require('fs');

async function deleteFile(ctx, filePath) {
  ctx.log(`deleteFile filePath=${filePath}`);
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      ctx.log(`deleteFile succeeded`);
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