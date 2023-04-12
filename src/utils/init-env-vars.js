const { logger } = require("./logger");

function config() {
  const STAGE = process.env.R1X_STAGE || "dev";
  logger.info(`Running R1X bot in ${STAGE} mode...`);

  require("dotenv").config({ path: "./.env." + STAGE });
}

module.exports = {
  config
};
