import os
import logging
from logging.handlers import TimedRotatingFileHandler

# This code was migrated from node.js to Python using ChatGPT.
# Rotation is not necessarily working well.
max_file_size = os.environ.get("MAX_LOG_FILE_SIZE", 100 * 1024 * 1024)
max_log_files = int(os.environ.get("MAX_LOG_FILES", 50))

log_formatter = logging.Formatter('%(asctime)s.%(msecs)03d %(message)s', datefmt='%Y-%m-%d %H:%M:%S')

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

class log_context():
    def __init__(self, context):
        self.context = context;

    def log(self, message, *args):
        merged_message = f"[{self.context}] {message} {' '.join(str(arg) for arg in args)}"
        logger.info(merged_message)

def create_logging_context(context):
    return log_context(context)
