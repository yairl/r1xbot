import os
import logging

import boto3
from botocore.exceptions import ClientError
from sqs_consumer import SqsConsumer

from src.utils import logger, create_logging_context, init_env_vars
from src.controllers.handle_incoming_messages import handle_incoming_message

init_env_vars.config()

num_of_consumers = 10
consumers = []
ctx = {"msgCount": 0}

sqs = boto3.client("sqs", region_name="eu-central-1")
queue_url = os.environ["SQS_QUEUE_URL"]

def process_message(message):
    global ctx
    ctx["msgCount"] += 1
    log_ctx = create_logging_context(ctx["msgCount"])
    log_ctx.log("Starting to handle message")

    result = handle_incoming_message(log_ctx, message.body)
    log_ctx.log("Finished handling message")

def on_error(err):
    logging.error(err)

for i in range(num_of_consumers):
    logger.info(f"starting listener #{i + 1} / {num_of_consumers}...")
    
    consumer = SqsConsumer(sqs, queue_url, process_message)
    consumer.on_error = on_error
    consumer.start()
    
    consumers.append(consumer)
    logger.info("done")
