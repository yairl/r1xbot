"use strict";
const fs = require('fs');

async function deleteFileUnsafe(ctx, filePath) {
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

async function deleteFile(ctx, filePath) {
  ctx.log(`deleteFile filePath=${filePath}`);
  try {
    await deleteFileUnsafe(ctx, filePath);
  } catch (err) {
    ctx.log(`deleteFile: deleteFileUnsafe thrown ${err}`);
  }
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
