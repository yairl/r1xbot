import argparse
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.utils import init_env_vars
init_env_vars.config()

from src.infra.context import Context
from src.services.messengers.messenger_factory import messenger_by_type

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Send a message to multiple chat ids.')
    parser.add_argument('--message', required=True, help='The message')
    parser.add_argument('--chat_ids', required=True, help='a comma seperated list of chat ids')
    parser.add_argument('--messenger', required=True, help='wa:Whatsapp, tg:Telegram')
    args = parser.parse_args()
    msg = args.message
    chat_ids=args.chat_ids.split(',')
    messenger = messenger_by_type[args.messenger]
    ctx = Context()
    messenger.multi_send(ctx, chat_ids, {
                "kind": "text",
                "body": msg,
            })
    
    