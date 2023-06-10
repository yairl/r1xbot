import os
import requests
import sys
from pathlib import Path
from dotenv import load_dotenv
from pydub import AudioSegment

from infra.context import Context
from infra.logger import logger

def download_stream_file(ctx:Context, url, path, headers=None):
    # Create the directory if it doesn't exist
    dir_path = Path(path).parent
    os.makedirs(dir_path, exist_ok=True)

    is_successful = False  # Variable to track download status

    response = requests.get(url, headers=headers, stream=True)

    with open(path, 'wb') as file:
        for chunk in response.iter_content(chunk_size=8192):
            file.write(chunk)

    if response.status_code == 200:
        ctx.log("downloadFile succeeded")
        is_successful = True

    return is_successful

def convert_audio_to_mp3(ctx:Context, orig_file_path:str, mp3_file_path:str) -> str:
    audio = AudioSegment.from_file(orig_file_path)
    audio.export(mp3_file_path, format="mp3")
    ctx.log("convertAudioToMp3 succeeded")

    return mp3_file_path

def load_env():
    stage = os.environ.get("R1X_STAGE", "dev")
    logger.info(f"Running R1X bot in {stage} mode...")

    load_dotenv(f"./.env.{stage}")


    # If no database is provided, resort to a locally-hosted SQLite version.
    # Typically used for testing.
    if os.environ.get('DB_CONNECTION_STRING', '') == '':
        os.environ['DB_CONNECTION_STRING'] = 'sqlite:///file::memory:?cache=shared'

    local_dev_required_envs = ['OPENAI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_NAME', 'SERPER_API_KEY']
    all_required_envs = local_dev_required_envs + ['AZURE_OPENAI_KEY', 'FACEBOOK_GRAPH_VERSION', 'WHATSAPP_BOT_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_PHONE_NUMBER', 'DB_CONNECTION_STRING', 'SQS_QUEUE_URL', 'DREAMSTUDIO_API_KEY', 'POSTHOG_API_KEY']

    required_envs = local_dev_required_envs if stage == 'dev-local' else all_required_envs

    # Ensure all reuqired environment variables are set up
    for v in required_envs:
        if os.environ.get(v, "") == "":
            print(f"Environment variable {v} is undefined or an empty string. Pleas configure it via you .env.{stage} file.")
            sys.exit(1)
