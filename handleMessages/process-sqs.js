"use strict";

const { logger, createLoggingContext } = require("./src/utils/logger");
require("./src/utils/init-env-vars").config();

const { Consumer } = require("sqs-consumer");
const { SQSClient } = require("@aws-sdk/client-sqs");
const { handler } = require("./index");

const ctx = { msgCount: 0 };

const numOfConsumers = 10;
const consumers = [];

for (let i = 0; i < numOfConsumers; i++) {
  logger.info(`starting listener #${i + 1} / ${numOfConsumers}...`);
  const app = Consumer.create({
    queueUrl: process.env.SQS_QUEUE_URL,
    handleMessage: async (message) => {
      const logCtx = createLoggingContext(++ctx.msgCount); 
      logCtx.log("Starting to handle message");

      const result = await handler(logCtx, message.Body);
      logCtx.log("Finished handling message");
    },
    sqs: new SQSClient({
      region: "eu-central-1"
    })
  });

  app.on("error", (err) => {
    console.error(err.message);
  });

  app.on("processing_error", (err) => {
    console.error(err.message);
  });

  app.on("timeout_error", (err) => {
    console.error(err.message);
  });

  app.start();
  consumers.push(app);
  logger.info("done");
}
