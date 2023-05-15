import argparse
import sys
import os
from typing import Dict, List

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.utils import init_env_vars
from src.services.messengers.messenger import MessagingService
init_env_vars.config()

from src.infra.context import Context
from src.services.messengers.messenger_factory import messenger_by_type

def multi_send(ctx:Context, full_chat_ids: List[str], attributes: Dict[str,str] ):
    for full_chat_id in full_chat_ids:
        messenger_str, chat_id = full_chat_id.split(':')
        messenger = messenger_by_type[messenger_str]
        attributes['chat_id'] = chat_id
        response = messenger.send_message_raw(ctx, attributes)
        print(response)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Send a message to multiple chat ids.')
    
    parser.add_argument('--message', required=True, help='The message')
    parser.add_argument('--chat_ids', required=True, help='a comma seperated list of <messenger wa/tg>:<chat ids> e.g wa:12346578,tg:456789654 ')
    args = parser.parse_args()
    
    msg = args.message
    full_chat_ids=args.chat_ids.split(',')
    
    ctx = Context()
    multi_send(ctx, full_chat_ids, {
                "kind": "text",
                "body": msg,
            })
    
    