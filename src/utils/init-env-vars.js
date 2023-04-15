const { logger } = require("./logger");

function config() {
  const STAGE = process.env.R1X_STAGE || "dev";
  logger.info(`Running R1X bot in ${STAGE} mode...`);

  const dotenv = require('dotenv');
  dotenv.config({ path: "./.env.unclassified." + STAGE });
  dotenv.config({ path: "./.env.secret." + STAGE });
}

module.exports = {
  config
};
