import os
import requests
from utils import downloader, media_converter, file_services
from messages import messages_service

class EventKindE:
    STATUS_UPDATE = 'status_update'
    MESSAGE = 'message'

class MessageKindE:
    TEXT = 'text'
    VOICE = 'voice'
    AUDIO = 'audio'

def get_event_kind(value):
    if 'statuses' in value:
        return EventKindE.STATUS_UPDATE
    if 'messages' in value:
        return EventKindE.MESSAGE
    return None

def get_message_kind(value):
    if value['type'] == 'audio':
        return MessageKindE.VOICE
    return value['type']

def parse_message(message):
    source = "wa"
    event_kind = get_event_kind(message['entry'][0]['changes'][0]['value'])
    if event_kind != EventKindE.MESSAGE:
        return None

    kind = get_message_kind(message['entry'][0]['changes'][0]['value']['messages'][0])
    message_timestamp = float(message['entry'][0]['changes'][0]['value']['messages'][0]['timestamp']) * 1e3
    sender_id = message['entry'][0]['changes'][0]['value']['messages'][0]['from']
    chat_id = sender_id
    chat_type = "private"
    is_sent_by_me = sender_id == os.environ['WHATSAPP_PHONE_NUMBER']
    message_id = message['entry'][0]['changes'][0]['value']['messages'][0]['id']
    reply_to_message_id = message['entry'][0]['changes'][0]['value']['messages'][0].get('context', {}).get('id')

    if kind == MessageKindE.TEXT:
        body = message['entry'][0]['changes'][0]['value']['messages'][0]['text']['body']
    else:
        body = None

    if kind == MessageKindE.VOICE:
        file_id = message['entry'][0]['changes'][0]['value']['messages'][0]['audio']['id']
    else:
        file_id = None

    file_unique_id = None

    return [{
        "source": source,
        "messageTimestamp": message_timestamp,
        "chatType": chat_type,
        "chatId": chat_id,
        "senderId": sender_id,
        "isSentByMe": is_sent_by_me,
        "messageId": message_id,
        "replyToMessageId": reply_to_message_id,
        "kind": kind,
        "body": body,
        "rawSource": message
    }, {
        "fileId": file_id,
        "fileUniqueId": file_unique_id
    }]

def get_bot_generated_message(ctx, send_message_response, attributes):
    chat_id, quote_id, kind, body = attributes['chatId'], attributes['quoteId'], attributes['kind'], attributes['body']
    message = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messages": [
                                {
                                    "timestamp": (int(time.time() * 1000) / 1e3),
                                    "from": os.environ['WHATSAPP_PHONE_NUMBER'],
                                    "id": send_message_response['data']['messages'][0]['id'],
                                    "type": kind,
                                    "text": {
                                        "body": body
                                    }
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    }

    return message

import os
import requests
import asyncio
from dotenv import load_dotenv

load_dotenv()

async def send_message(ctx, attributes):
    chat_id, quote_id, kind, body = attributes.values()

    response = await send_message_raw(ctx, attributes)

    if 'data' in response:
        message = get_bot_generated_message(ctx, response, attributes)
        parsed_message, file_info = parse_message(message)

        parsed_message['chatId'] = chat_id
        ctx.log(parsed_message)

        await insert_message(ctx, parsed_message)
        ctx.log(f"Message inserted successfully: {parsed_message}")

async def send_message_raw(ctx, attributes):
    chat_id, quote_id, kind, body = attributes.values()

    if kind != "text":
        return

    headers = {
        "Authorization": f"Bearer {os.environ['WHATSAPP_BOT_TOKEN']}",
        "Content-Type": "application/json"
    }

    args = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": chat_id,
        "type": "text",
        "text": {
            "preview_url": False,
            "body": body
        }
    }

    if quote_id:
        args["context"] = {"message_id": quote_id}

    try:
        response = requests.post(
            f"https://graph.facebook.com/{os.environ['FACEBOOK_GRAPH_VERSION']}/{os.environ['WHATSAPP_PHONE_NUMBER_ID']}/messages",
            json=args,
            headers=headers
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as error:
        ctx.log(f"sendMessageRaw: exception. error.response.data={error.response.data}")
        raise error

    return response.json()

def is_message_for_me(msg):
    if msg['chatType'] == "private":
        return True

    return False

async def get_voice_mp3_file(ctx, parsed_message, file_info):
    ctx.log(f"getVoiceMp3File: {parsed_message}, {file_info}")
    url = await get_download_url(ctx, file_info['fileId'])
    ogg_file_path, mp3_file_path = get_audio_file_paths(ctx, parsed_message['chatId'], file_info)
    is_download_successful = False

    try:
        headers = {
            "Authorization": f"Bearer {os.environ['WHATSAPP_BOT_TOKEN']}",
        }

        is_download_successful = await downloader.download_stream_file(ctx, url, ogg_file_path, headers)
        await media_converter.convert_ogg_to_mp3(ctx, ogg_file_path, mp3_file_path)

        return mp3_file_path

    finally:
        delete_ogg_file = is_download_successful or file_services.file_exists(ogg_file_path)
        if delete_ogg_file:
            file_services.delete_file(ctx, ogg_file_path)

async def get_download_url(ctx, file_id):
    ctx.log(f"getDownloadUrl: {file_id}")
    headers = {
        "Authorization": f"Bearer {os.environ['WHATSAPP_BOT_TOKEN']}",
    }

    try:
        response = requests.get(
            f"https://graph.facebook.com/{os.environ['FACEBOOK_GRAPH_VERSION']}/{file_id}?phone_number_id={os.environ['WHATSAPP_PHONE_NUMBER_ID']}",
            headers=headers
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as error:
        ctx.log(f"getDownloadUrl: exception. error.response.data={error.response.data}")
        raise error

    download_url = response.json()['url']

    ctx.log(f"getDownloadUrl: downloadUrl={download_url}")
    return download_url

def get_audio_file_paths(ctx, chat_id, file_info):
    temp_dir_path = file_services.make_temp_dir_name(f"r1x/wa/{chat_id}_")
    file_path_name = temp_dir_path + '/audio'
    ogg_file_path = file_path_name + '.ogg'
    mp3_file_path = file_path_name + '.mp3'

    ctx.log(f"getAudioFilePaths: oggFilePath={ogg_file_path}, mp3FilePath={mp3_file_path}")
    return ogg_file_path, mp3_file_path


def set_typing(chat_id, in_flight):
    # TODO: igors - can't find WA API for typing indication.
    return


async def set_status_read(ctx, message_id):
    ctx.log("setStatusRead")
    headers = {
        "Authorization": f"Bearer {os.environ['WHATSAPP_BOT_TOKEN']}",
        "Content-Type": "application/json",
    }

    args = {
        "messaging_product": "whatsapp",
        "status": "read",
        "message_id": message_id,
    }

    try:
        response = requests.post(
            f"https://graph.facebook.com/{os.environ['FACEBOOK_GRAPH_VERSION']}/{os.environ['WHATSAPP_PHONE_NUMBER_ID']}/messages",
            json=args,
            headers=headers
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as error:
        ctx.log(f"setStatusRead: exception. error.response.data={error.response.data}")
        return

    if response.json().get('success') != True:
        ctx.log(f"setStatusRead: response is wrong. Compared field {response.json().get('success')}. Full response {response}")

__all__ = [
    "parse_message",
    "send_message",
    "send_message_raw",
    "is_message_for_me",
    "set_typing",
    "get_voice_mp3_file",
    "set_status_read",
]
