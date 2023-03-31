require("dotenv").config();

async function run() {
  const input = { messages: [{ role: "user", content: "are you here?" }] };

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
