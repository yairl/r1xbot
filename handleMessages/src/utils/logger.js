var winston = require("winston");
require("winston-daily-rotate-file");

const maxFileSize = process.env.MAX_LOG_FILE_SIZE || "10m";
const maxLogFiles = process.env.MAX_LOG_FILES || "10";

var transport = new winston.transports.DailyRotateFile({
  level: "info",
  filename: "/tmp/r1x/logs/r1x-%DATE%.log",
  datePattern: "YYYY-MM-DD-HH",
  zippedArchive: true,
  maxSize: maxFileSize,
  maxFiles: maxLogFiles
});

var logger = winston.createLogger({
  transports: [
    transport,
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

module.exports = logger;
