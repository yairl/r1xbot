require("dotenv").config();

const userPid = `${process.env.USER_NUMBER}@c.us`;
const r1xPid = `${process.env.R1X_NUMBER}@c.us`;

const messages = [
  {
    sqsMessageType: "newMessageReceived",
    messageInfo: {
      source: "whatsapp",
      messageTimestamp: Date.now(),
      chatId: userPid,
      senderId: userPid,
      messageId: "3EB0680A789FAD6BB647F8",
      kind: "text",
      additionalData: {
        message: "Hey, are you here?"
      }
    }
  },
  {
    sqsMessageType: "newMessageReceived",
    messageInfo: {
      source: "whatsapp",
      messageTimestamp: Date.now(),
      chatId: userPid,
      senderId: r1xPid,
      messageId: "3EB0680A789FAD6BB65324",
      kind: "text",
      additionalData: {
        message: "Yes, I'm here. How may I assist you?",
        quotedMessageId: "3EB0680A789FAD6BB647F8"
      }
    }
  },
  {
    sqsMessageType: "newMessageReceived",
    messageInfo: {
      source: "whatsapp",
      messageTimestamp: Date.now(),
      chatId: userPid,
      senderId: userPid,
      messageId: "3EB0680A789FADFAA65324",
      kind: "text",
      additionalData: {
        message: "Who was the first man in space?"
      }
    }
  }
];

async function run() {
  for (message of messages) {
    const event = {
      Records: [
        {
          body: JSON.stringify(message)
        }
      ]
    };

    const { handler } = require("./index");
    await handler(event);
  }
}

run();
