#!/usr/bin/python3

import os
import logging

import boto3
from botocore.exceptions import ClientError

from src.utils import logger, init_env_vars
init_env_vars.config()

from src.controllers.handle_incoming_messages import handle_incoming_message

from concurrent.futures import ThreadPoolExecutor

num_of_consumers = 10
consumers = []
ctx = {"msgCount": 0}

sqs = boto3.client("sqs", region_name="eu-central-1")
queue_url = os.environ["SQS_QUEUE_URL"]

def process_message(message):
    global ctx
    ctx["msgCount"] += 1
    log_ctx = logger.create_logging_context(ctx["msgCount"])
    log_ctx.log("Starting to handle message")

    result = handle_incoming_message(log_ctx, message['body'])
    log_ctx.log("Finished handling message")

def main():
    # Using ThreadPoolExecutor to handle tasks concurrently
    with ThreadPoolExecutor() as executor:
        while True:
            try:
                # Receive messages from SQS queue
                logger.logger.info("Listening on SQS queue...")
                response = sqs.receive_message(QueueUrl=queue_url, MaxNumberOfMessages=1, WaitTimeSeconds=20)

                print(response)

                if 'Messages' in response:
                    messages = response['Messages']
                    futures = []

                    for message in messages:
                        # Launch a separate task for each message
                        future = executor.submit(process_message, message)
                        futures.append((future, message['ReceiptHandle']))

                    # Wait for all tasks to complete and handle the results
                    for future, receipt_handle in futures:
                        if future.result():
                            delete_message_from_queue(receipt_handle)
                else:
                    print("No messages in the queue. Waiting...")
            except ClientError as e:
                print(f"Error receiving messages from queue. Error: {e}")

if __name__ == "__main__":
    main()
