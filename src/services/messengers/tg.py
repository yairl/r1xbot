import os
import random
import requests
from utils import downloader, media_converter, file_services
from messages import messages_service

class MessageKindE:
    TEXT = 'text'
    VOICE = 'voice'
    AUDIO = 'audio'

def get_message_kind(message):
    if 'text' in message:
        return MessageKindE.TEXT
    if 'voice' in message:
        return MessageKindE.VOICE
    if 'audio' in message:
        return MessageKindE.AUDIO
    return None

def parse_message(message):
    message = message['message']

    source = "tg"
    message_timestamp = message['date'] * 1000
    chat_type = message['chat']['type']
    chat_id = str(message['chat']['id'])
    sender_id = str(message['from']['id'])
    is_sent_by_me = message['from']['id'] == int(os.environ['TELEGRAM_SENDER_ID'])
    messageId = str(message['message_id'])
    reply_to_message_id = message['reply_to_message']['message_id'] if 'reply_to_message' in message else None
    kind = get_message_kind(message)
    body = message['text'] if 'text' in message else None
    fileId = message['voice']['file_id'] if kind == MessageKindE.VOICE else None
    fileUniqueId = message['voice']['file_unique_id'] if kind == MessageKindE.VOICE else None

    return (
        {
            'source': source,
            'messageTimestamp': message_timestamp,
            'chatType': chat_type,
            'chatId': chat_id,
            'senderId': sender_id,
            'isSentByMe': is_sent_by_me,
            'messageId': messageId,
            'replyToMessageId': reply_to_message_id,
            'kind': kind,
            'body': body,
            'rawSource': message
        },
        {
            'fileId': fileId,
            'fileUniqueId': fileUniqueId
        }
    )

async def send_message(ctx, attributes):
    response = send_message_raw(ctx, attributes)

    if response['ok']:
        message = {'message': response['result']}

        parsed_message, file_info = parse_message(message)
        ctx.log({'parsedMessage': parsed_message})

        await messages_service.insert_message(ctx, parsed_message)
        ctx.log(f'Message inserted successfully: {parsed_message}')

def send_message_raw(ctx, attributes):
    chat_id, quote_id, kind, body = attributes['chatId'], attributes['quoteId'], attributes['kind'], attributes['body']

    if kind != "text":
        return

    args = {'chat_id': chat_id, 'text': body}
    if quote_id:
        args['reply_to_message_id'] = quote_id
        args['allow_sending_without_reply'] = True

    response = requests.post(
        f'https://api.telegram.org/bot{os.environ["TELEGRAM_BOT_TOKEN"]}/sendMessage',
        json=args
    ).json()

    return response

def is_message_for_me(msg):
    if msg['chatType'] == "private":
        return True

    if msg['body'].startswith(f'@{os.environ["TELEGRAM_BOT_NAME"]}'):
        return True

    if 'reply_to_message' in msg['rawSource'] and msg['rawSource']['reply_to_message']['from']['id'] == int(os.environ['TELEGRAM_SENDER_ID']):
        return True

    return False

import os
import random
import time
import requests
from utils import downloader, media_converter, file_services
from messages import messages_service

# ... (class MessageKindE and other functions)

def get_voice_mp3_file(ctx, parsed_message, file_info):
    url = get_download_url(ctx, file_info["fileId"])
    ogg_file_path, mp3_file_path = get_audio_file_paths(ctx, parsed_message["chatId"], file_info)
    is_download_successful = False
    try:
        is_download_successful = downloader.download_stream_file(ctx, url, ogg_file_path)
        media_converter.convert_ogg_to_mp3(ctx, ogg_file_path, mp3_file_path)

        return mp3_file_path

    finally:
        delete_ogg_file = is_download_successful or file_services.file_exists(ogg_file_path)
        if delete_ogg_file:
            file_services.delete_file(ctx, ogg_file_path)

def get_download_url(ctx, file_id):
    args = {"file_id": file_id}

    response = requests.post(
        f"https://api.telegram.org/bot{os.environ['TELEGRAM_BOT_TOKEN']}/getFile",
        json=args,
    )
    data = response.json()

    if not data["ok"]:
        ctx.log(f"getDownloadUrl failed. response={data}")

    remote_file_path = data["result"]["file_path"]
    download_url = f"https://api.telegram.org/file/bot{os.environ['TELEGRAM_BOT_TOKEN']}/{remote_file_path}"

    ctx.log(f"getDownloadUrl: downloadUrl={download_url}")
    return download_url

def get_audio_file_paths(ctx, chat_id, file_info):
    temp_dir_path = file_services.make_temp_dir_name(f"r1x/tg/{chat_id}_")
    file_path_name = os.path.join(temp_dir_path, "audio")
    ogg_file_path = f"{file_path_name}.ogg"
    mp3_file_path = f"{file_path_name}.mp3"

    ctx.log(f"getAudioFilePaths: oggFilePath={ogg_file_path}, mp3FilePath={mp3_file_path}")
    return ogg_file_path, mp3_file_path

def set_typing(chat_id, in_flight):
    if not in_flight["working"]:
        return

    base_timeout = 6000
    extra_timeout = random.randint(0, 1500)
    time.sleep((base_timeout + extra_timeout) / 1000)

    requests.post(
        f"https://api.telegram.org/bot{os.environ['TELEGRAM_BOT_TOKEN']}/sendChatAction",
        json={"chat_id": chat_id, "action": "typing"},
    )

def set_status_read(ctx, message_id):
    pass
    
# setStatusRead is not needed in Python, as it's an empty function in the JavaScript code.

__all__ = [
    "parse_message",
    "send_message",
    "send_message_raw",
    "is_message_for_me",
    "set_typing",
    "get_voice_mp3_file",
    "set_status_read"
]
