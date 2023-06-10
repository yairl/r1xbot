#!/usr/bin/python3

import json
import os

import boto3
from services.timers import alert_users

from infra import logger
from infra.context import Context

import message_handler

import threading
import traceback

from telegram import ForceReply, Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

NUM_CONSUMERS = 10

QUEUE_URL = os.environ["SQS_QUEUE_URL"]

def process_message(message):
    ctx = Context()
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

def launch_sqs_threads():
    logger.logger.info(f'Listening on {NUM_CONSUMERS} queues...')

    threads = []
  
    for i in range(NUM_CONSUMERS):
        queue = boto3.client('sqs', region_name='eu-central-1')
        thread = threading.Thread(target=single_sqs_handler, args=(queue,))
        thread.start()
        threads.append(thread)

    return threads

async def handle_local_incoming_telegram_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message = { 'Body' : json.dumps({ 'source' : 'tg', 'event' : json.loads(update.to_json()) }) }
    ctx = Context()

    process_message(message)

def launch_local_telegram_listener():
    # Create the Application and pass it your bot's token.
    application = Application.builder().token(os.environ['TELEGRAM_BOT_TOKEN']).build()

    # on non command i.e message - echo the message on Telegram
    tg_filters = (filters.AUDIO | filters.TEXT | filters.VOICE) & ~filters.COMMAND
    application.add_handler(MessageHandler(tg_filters, handle_local_incoming_telegram_message))

    # Run the bot until the user presses Ctrl-C
    application.run_polling()

    # Threads to wait on; never reached
    return []

def main():
    threads = []

    timer_thread = threading.Thread(target=alert_users)
    timer_thread.start()
    threads.append(timer_thread)

    if os.environ['R1X_STAGE'] in ['dev', 'prod']:
        threads = launch_sqs_threads()
    else:
        threads = launch_local_telegram_listener()

    for thread in threads:
        thread.join()

if __name__ == "__main__":
    main()
