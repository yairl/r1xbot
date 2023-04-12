const util = require('util');

const winston = require('winston');
require('winston-daily-rotate-file');

const maxFileSize = process.env.MAX_LOG_FILE_SIZE || "100m";
const maxLogFiles = process.env.MAX_LOG_FILES || "50";

var transport = new winston.transports.DailyRotateFile({
  level: "info",
  filename: "./logs/r1x-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: maxFileSize,
  maxFiles: maxLogFiles
});

var logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp({format: 'YYYY-MM-DD HH:mm:ss.SSS'}),
    winston.format.printf((info) => {
      return `${info.timestamp} ${info.message}`;
    })
  ),
  transports: [
    transport,
    new winston.transports.Console()
  ]
});

function createLoggingContext(context) {
  const logFn = function log(message, ...args) {
    const inspectedArgs = [util.inspect(message)]
    for (const arg of args) {
      inspectedArgs.push(util.inspect(arg));
    }
 
    mergedMessage = `[${context}] ${inspectedArgs.join(' ')}`;
    logger.info(mergedMessage);
  }

  return { log : logFn };
} 

module.exports = {
  logger,
  createLoggingContext
};
