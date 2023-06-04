#!/usr/bin/python3

import os

import boto3
from services.timers import alert_users

from infra import logger
from infra.context import Context

import message_handler

import threading
import traceback

NUM_CONSUMERS = 10

QUEUE_URL = os.environ["SQS_QUEUE_URL"]

def process_message(message):
    ctx = Context()
    print(message)
    result = message_handler.handle_incoming_message(ctx, message['Body'])
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
    
     
    timer_thread = threading.Thread(target=alert_users)
    timer_thread.start()
    threads.append(timer_thread)

    for thread in threads:
        thread.join()

if __name__ == "__main__":
    main()
