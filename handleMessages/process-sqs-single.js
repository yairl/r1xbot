require("dotenv").config();

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const sqs = new AWS.SQS({ region: 'eu-central-1' });
const queueUrl = 'https://sqs.eu-central-1.amazonaws.com/165354665739/ingress-queue.fifo';

const { handler } = require('./index');

// Receive messages from the SQS queue
const receiveParams = {
  QueueUrl: queueUrl,
  MaxNumberOfMessages: 1, // batch size
  WaitTimeSeconds: 20 // Wait up to 20 seconds for messages to become available
};

sqs.receiveMessage(receiveParams, messageHandler);

async function messageHandler(err, data) {
  if (err) {
    console.log('Error receiving message:', err);
  } else if (data.Messages) {
    console.log('Received', data.Messages.length, 'messages:');
    data.Messages.forEach((message) => {
//      console.log('Message ID:', message.MessageId);
//      console.log('Message Body:', message.Body);
//      console.log('Message Attributes:', message.MessageAttributes);
//      console.log('Message Receipt Handle:', message.ReceiptHandle);
      handler(message.Body);

      const deleteParams = {
        QueueUrl: queueUrl,
        ReceiptHandle : message.ReceiptHandle
      };

      console.log(deleteParams);
 
      const result = sqs.deleteMessage(deleteParams, (err, data) => {console.log(err); console.log(data);});
      console.log(result);
    });
  }
}
