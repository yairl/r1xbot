const {
  handleIncomingMessage,
} = require("./src/controllers/handle-incoming-messages");

exports.handler = handleIncomingMessage;
