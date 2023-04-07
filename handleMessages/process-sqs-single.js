const logger = require("./src/utils/logger");
require("./src/utils/init-env-vars").config();

var ctx = { msgCount: 0 };

const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");

const sqs = new AWS.SQS({ region: "eu-central-1" });
const queueUrl =
  "https://sqs.eu-central-1.amazonaws.com/165354665739/ingress-queue.fifo";

const { handler } = require("./index");

// Receive messages from the SQS queue
const receiveParams = {
  QueueUrl: queueUrl,
  MaxNumberOfMessages: 1, // batch size
  WaitTimeSeconds: 20 // Wait up to 20 seconds for messages to become available
};

sqs.receiveMessage(receiveParams, messageHandler);

async function messageHandler(err, data) {
  if (err) {
    logger.info(`Error receiving message:`, err);
  } else if (data.Messages) {
    logger.info("Received", data.Messages.length, "messages:");
    data.Messages.forEach((message) => {
      currMsgCount = ++ctx.msgCount;
      //      logger.info(`[${currMsgCount}] Message ID:`, message.MessageId);
      //      logger.info(`[${currMsgCount}] Message Body:`, message.Body);
      //      logger.info(`[${currMsgCount}] Message Attributes:`, message.MessageAttributes);
      //      logger.info(`[${currMsgCount}] Message Receipt Handle:`, message.ReceiptHandle);
      handler(currMsgCount, message.Body);

      const deleteParams = {
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle
      };

      logger.info(`[${currMsgCount}] Delete parameters: `, deleteParams);

      const result = sqs.deleteMessage(deleteParams, (err, data) => {
        logger.info(`[${currMsgCount}] ${err}`);
        logger.info(`[${currMsgCount}] ${data}`);
      });
      logger.info(`[${currMsgCount}] Delete result: `, result);
    });
  }
}
