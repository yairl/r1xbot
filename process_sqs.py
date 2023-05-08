#!/usr/bin/python3

import os
import logging

import boto3
from botocore.exceptions import ClientError

from src.utils import logger, init_env_vars
init_env_vars.config()

from src.controllers.handle_incoming_messages import handle_incoming_message

import threading
import traceback

class ThreadSafeCounter:
    def __init__(self):
        self._counter = 0
        self._lock = threading.Lock()

    def get_and_increment(self):
        with self._lock:
            val = self._counter
            self._counter += 1
            return val

# Usage
counter = ThreadSafeCounter()

NUM_CONSUMERS = 10

QUEUE_URL = os.environ["SQS_QUEUE_URL"]

def process_message(message):
    ctx = { 'msgCount' : counter.get_and_increment() }

    log_ctx = logger.create_logging_context(ctx['msgCount'])
    log_ctx.log("Starting to handle message")

    print(message)
    result = handle_incoming_message(log_ctx, message['Body'])
    log_ctx.log("Finished handling message")

def single_sqs_handler(queue):
    while True:
        try:
            single_sqs_handler_core(queue)
        except Exception as e:
            logger.logger.error(f'Exception occurred; {e}; stack trace: ', traceback.format_exc())

def single_sqs_handler_core(queue):
    response = queue.receive_message(QueueUrl=QUEUE_URL, MaxNumberOfMessages=1, WaitTimeSeconds=20)

    if not 'Messages' in response:
       return

    # Single message each time
    message = response['Messages'][0]

    process_message(message)

    queue.delete_message(QueueUrl=QUEUE_URL, ReceiptHandle=message['ReceiptHandle'])


def main():
    threads = []

    logger.logger.info(f'Listening on {NUM_CONSUMERS} queues...')

    for i in range(NUM_CONSUMERS):
        queue = boto3.client('sqs', region_name='eu-central-1')
        thread = threading.Thread(target=single_sqs_handler, args=(queue,))
        thread.start()
        threads.append(thread)

    while True:
        pass

if __name__ == "__main__":
    main()
