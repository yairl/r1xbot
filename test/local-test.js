require("../src/utils/init-env-vars").config();
const fs = require('fs');

const { logger, createLoggingContext } = require("../src/utils/logger");
const { getChatCompletionWithTools } = require("../src/services/open-ai/query-openai");

async function run() {
  const args = process.argv.slice(2);

  // Check if the user specified any command line arguments
  if (args.length === 0) {
    console.log("No arguments provided.");
    process.exit(1);
  }

  jsonInput = args[0];

  const data = await fs.readFileSync(jsonInput, {encoding : 'utf8', flag: 'r'});
  const history = await JSON.parse(data).messages;

  const ctx = createLoggingContext(0);
  const reply = getChatCompletionWithTools(ctx, 'WhatsApp', history, true);

  console.log({reply});
};

run();
