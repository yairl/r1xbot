import os
import requests
from pathlib import Path

def download_stream_file(ctx, url, path, headers=None):
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

