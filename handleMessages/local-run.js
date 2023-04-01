require("dotenv").config();

async function run() {
  const input = {
    messages: [{ role: "user", content: "are you here?" }],
    messageInfo: {
      chatId: "972509519944@c.us",
      messageId: "3EB0680A789FAD6BB647F8",
    },
  };

  const event = {
    Records: [
      {
        body: JSON.stringify(input),
      },
    ],
  };

  const { handler } = require("./index");
  await handler(event);
}

run();
