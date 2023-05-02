import os
from pathlib import Path
import tempfile

async def delete_file_unsafe(ctx, file_path):
    try:
        os.remove(file_path)
        ctx.log("deleteFile succeeded")
    except OSError as err:
        raise err

async def delete_file(ctx, file_path):
    ctx.log(f"deleteFile filePath={file_path}")
    try:
        await delete_file_unsafe(ctx, file_path)
    except OSError as err:
        ctx.log(f"deleteFile: deleteFileUnsafe thrown {err}")

def file_exists(file_path):
    return Path(file_path).exists()

def make_temp_dir_name(prefix):
    tmp_root = os.environ.get("TMPDIR", tempfile.gettempdir())

    prefix_path = os.path.join(tmp_root, os.path.dirname(prefix))
    os.makedirs(prefix_path, exist_ok=True)

    full_temp_dir_path_base = os.path.join(tmp_root, prefix)
    full_temp_dir_path = tempfile.mkdtemp(prefix=full_temp_dir_path_base)

    return full_temp_dir_path

