import json
import os
import tiktoken

# global variable to hold the encode objects between invocations
encoder = None

def num_tokens_from_messages(messages):
    global encoder
    if not encoder:
        raise ValueError("encoder is not initialized")

    num_tokens = 0
    for message in messages:
        num_tokens += 4
        for key, value in message.items():
            num_tokens += len(encoder.encode(value))
            if key == "name":
                num_tokens -= 1

    num_tokens += 2
    num_tokens += 1
    return num_tokens

def get_message_tokens(message):
    if len(message) == 0:
        raise ValueError(f"message is malformed. It's {message} but doesn't have any keys")

    num_tokens = 0
    num_tokens += 4
    for key, value in message.items():
        num_tokens += len(encoder.encode(value))
        if key == "name":
            num_tokens -= 1

    return num_tokens

def get_message_index_upto_max_tokens(system_message, chat_messages, soft_token_limit, hard_token_limit):
    global encoder
    if not encoder:
        raise ValueError("encoder is not initialized")

    num_tokens = 0
    num_tokens += 2
    num_tokens += 1

    include_system_message = False
    start_index = len(chat_messages)

    num_tokens += get_message_tokens(system_message)

    if num_tokens > hard_token_limit:
        return [include_system_message, start_index]

    include_system_message = True

    num_messages = 0

    for start_index in range(len(chat_messages), 0, -1):
        message = chat_messages[start_index - 1]

        num_tokens += get_message_tokens(message)

        if num_tokens <= soft_token_limit:
            num_messages += 1
            continue

        if start_index == len(chat_messages) and num_tokens <= hard_token_limit:
            num_messages += 1
            continue

        break

    return [include_system_message, len(chat_messages) - num_messages]

def get_messages_upto_max_tokens(ctx, system_message, chat_messages, soft_token_limit, hard_token_limit):
    ctx.log(f"getMessagesUptoMaxTokens: chatMessages.length={len(chat_messages)}, softTokenLimit={soft_token_limit}, hardTokenLimit={hard_token_limit}")

    global encoder
    if not encoder:
        raise ValueError("encoder is not initialized")

    include_system_message, start_index = get_message_index_upto_max_tokens(system_message, chat_messages, soft_token_limit, hard_token_limit)

    result = [system_message] if include_system_message else []

    if not include_system_message or start_index == len(chat_messages):
        return result

    result += chat_messages[start_index:]

    return result

def init():
    global encoder
    try:
        encoder = tiktoken.get_encoding("cl100k_base")
    except Exception as error:
        print('Error occurred while initializing:', error)

def cleanup():
    global encoder
    encoder = None

init()

