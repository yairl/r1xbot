import os
import requests
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

