const {
  handleIncomingMessage,
} = require("./controllers/handle-incoming-messages");

exports.handler = handleIncomingMessage;
