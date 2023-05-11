#!/usr/bin/python3

import os
import logging
import time

import boto3
from botocore.exceptions import ClientError

from src.utils import logger, init_env_vars
from tools.context import Context
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
    ctx = Context()
    print(message)
    result = handle_incoming_message(ctx, message['Body'])
    ctx.log("Finished handling message")

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

    for thread in threads:
        thread.join()

if __name__ == "__main__":
    main()
