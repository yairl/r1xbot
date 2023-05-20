import os
import utils.logger
from dotenv import load_dotenv

def config():
    stage = os.environ.get("R1X_STAGE", "dev")
    utils.logger.logger.info(f"Running R1X bot in {stage} mode...")

    load_dotenv(f"./.env.{stage}")

