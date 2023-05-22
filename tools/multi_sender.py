#!/usr/bin/python3

import argparse
import sys
import os
from typing import Dict, List

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))
from infra import utils 
from infra.context import Context
from services.messengers.messenger_factory import get_messenger_and_chat_id

utils.load_env()


def multi_send(ctx:Context, full_chat_ids: List[str], attrs: Dict[str,str]):
    for full_chat_id in full_chat_ids:
        messenger, chat_id = get_messenger_and_chat_id(full_chat_id)
        attrs['chat_id'] = chat_id
        response = messenger.send_message(ctx, attrs)
        print(response)

        should_send_contact = attrs['contact_name'] and attrs['contact_handle']
        if should_send_contact:
            response = messenger.send_contact(ctx, chat_id, attrs['contact_name'], attrs['contact_handle'])
            print(response)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Send a message to multiple chat ids.')
    
    parser.add_argument('--message', required=False, help='Message string.')
    parser.add_argument('--file', required=False, help='Message string, in file.')
    parser.add_argument('--chat_ids', required=True, help='a comma seperated list of <messenger wa/tg>:<chat ids> e.g wa:12346578,tg:456789654 ')
    parser.add_argument('--contact-name', required=False, action='store', help='''Send contact. Name is the contact's name.''')
    parser.add_argument('--contact-handle', required=False, action='store', help='''Send contact. Handle is contact's handle in WhatsApp/Telegram.''')

    args = parser.parse_args()
    
    if not args.message and not args.file:
        print('No message provided. Use --message or --file')

    if args.message:
        msg = args.message
    else:
        msg = open(args.file, 'r').read()

    full_chat_ids=args.chat_ids.split(',')

    ctx = Context()
    multi_send(ctx, full_chat_ids, {
            "kind": "text",
            "body": msg,
            "contact_name" : args.contact_name,
            "contact_handle" : args.contact_handle
        })
    
    
