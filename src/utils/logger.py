import os
import logging
from logging.handlers import TimedRotatingFileHandler

max_file_size = os.environ.get("MAX_LOG_FILE_SIZE", 100 * 1024 * 1024)
max_log_files = int(os.environ.get("MAX_LOG_FILES", 50))

log_formatter = logging.Formatter('%(asctime)s %(message)s', datefmt='%Y-%m-%d %H:%M:%S.%f')

file_handler = TimedRotatingFileHandler('./logs/r1x.log', when='D', interval=1, backupCount=max_log_files)
file_handler.setFormatter(log_formatter)
file_handler.setLevel(logging.INFO)
file_handler.suffix = '%Y-%m-%d'
file_handler.extMatch = file_handler.extMatch

console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)
console_handler.setLevel(logging.INFO)

logger = logging.getLogger()
logger.setLevel(logging.INFO)
logger.addHandler(file_handler)
logger.addHandler(console_handler)

def create_logging_context(context):
    def log_fn(message, *args):
        merged_message = f"[{context}] {message} {' '.join(str(arg) for arg in args)}"
        logger.info(merged_message)

    return {"log": log_fn}

