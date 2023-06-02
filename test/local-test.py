#!/usr/bin/python3

import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))

from infra.utils import load_env
load_env()

import sys
import json
import asyncio
from pathlib import Path
from infra.logger import logger, create_logging_context
from services.open_ai.query_openai import get_chat_completion_with_tools

def run():
    args = sys.argv[1:]

    # Check if the user specified any command line arguments
    if not args:
        print("No arguments provided.")
        sys.exit(1)

    json_input = args[0]

    with open(json_input, 'r', encoding='utf-8') as file:
        data = file.read()
    history = json.loads(data)["messages"]

    ctx = create_logging_context(0)
    ctx.user_channel = 'stable'
    #ctx.user_channel = 'canary'

    def dummy_fn(*args, **kwargs):
        return

    ctx.set_stat = dummy_fn 
    reply = get_chat_completion_with_tools(ctx, 'WhatsApp', history, True)

    print({'reply': reply})

run()
