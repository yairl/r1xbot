require("dotenv").config();

const { msgs } = require("./samples/inputs.js");

const messages = [
  msgs.wa_private_msg
  // msgs.wa_group_msg,
  // msgs.tg_private_msg
  // msgs.tg_group_msg,
  // msgs.tg_private_fwdd_msg
];

async function run() {
  for (message of messages) {
    const event = JSON.stringify(message);

    const { handler } = require("./index");
    await handler(event);
  }
}

run();
