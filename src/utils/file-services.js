"use strict";
const fs = require('fs');
const os = require('os');
const path = require('path');

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

function makeTempDirName(prefix) {
  const tmpRoot = process.env.TMPDIR || os.tmpdir();

  const prefixPath = tmpRoot + path.sep + path.dirname(prefix);
  if (!fs.existsSync(prefixPath)) {
    fs.mkdirSync(prefixPath, { recursive: true });
  }

  const fullTempDirPathBase = path.join(tmpRoot, prefix);  
  const fullTempDirPath = fs.mkdtempSync(fullTempDirPathBase);
  
  return fullTempDirPath;
}

module.exports = {
    deleteFile,
    fileExists,
    makeTempDirName
};
