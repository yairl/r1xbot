import time
import json
import os
import pathlib
import tempfile

from posthog import Posthog
from sqlalchemy import desc

from typing import Any, Dict

from services.messengers import messenger_factory
from services.messengers.messenger import MessagingService

from services.open_ai.query_openai import get_chat_completion, get_chat_completion_with_tools, create_transcription
import db_models
from services.message_db import insert_message, get_message_history
import services.messengers as messengers
from infra.context import Context

posthog_client = None
if os.environ.get('POSTHOG_API_KEY', '') != '':
    posthog_client = Posthog(
        os.environ['POSTHOG_API_KEY'],
        host='https://app.posthog.com'
    )

def posthog_capture(distinct_id, event, properties):
    if posthog_client == None:
        return

    posthog_client.capture(distinct_id=distinct_id, event=event, properties=properties)

def get_user_settings(parsed_message) -> Dict[str, Any]: 
    user_id = f"{parsed_message.source}:{parsed_message.chatId}"
    session = db_models.Session()

    settings = session.query(db_models.UserSettings) \
                .filter(db_models.UserSettings.user_id == user_id) \
                .order_by(desc(db_models.UserSettings.createdAt)) \
                .limit(1) \
                .one_or_none()

    session.close()

    return getattr(settings, 'settings', {})


def handle_incoming_message(ctx: Context, event):
    in_flight = {"working": True}

    try:
        handle_incoming_message_core(ctx, event, in_flight)
    except Exception as error:
        ctx.log("Message processing failed: ",error)
        raise Exception("Message processing failed.")
    finally:
        in_flight["working"] = False


def handle_incoming_message_core(ctx:Context, event, in_flight):
    start = time.time()
    parsed_event = json.loads(event)
    messenger = messenger_factory.messenger_by_type[parsed_event["source"]]
    
    parse_message_result = messenger.parse_message(parsed_event["event"])
    
    if parse_message_result is None:
        return

    parsed_message, file_info = parse_message_result

    messenger.set_status_read(ctx, parsed_message.messageId)

    ctx.user_settings = get_user_settings(parsed_message)
    ctx.user_channel = ctx.user_settings.get('channel', 'stable')
 
    is_typing = False

    if parsed_message.kind == "voice":
        is_typing = True
        handle_audio_message(ctx, messenger, parsed_message, file_info, in_flight)

        if parsed_message.isForwarded:
            return

    message = insert_message(ctx, parsed_message)

    if message.isSentByMe or message.body is None:
        return

    if not messenger.is_message_for_me(message):
        return

    if not is_typing:
        messenger.set_typing(parsed_message.chatId, in_flight)
        is_typing = True

    message_history = get_message_history(ctx, message)
    ctx.log("message history pulled.")

    if len(message_history) <= 1:
        ctx.log("sending intro message.")
        send_intro_message(ctx, messenger, parsed_message)
        return

    ctx.log("calling get_chat_completion...")
    messenger_name = "WhatsApp" if parsed_event["source"] == "wa" else "Telegram"
    completion = get_chat_completion_with_tools(ctx, messenger_name, message_history, direct=False, parsed_message=parsed_message)

    ctx.log({"completion": completion})
    ctx.log("get_chat_completion done, result is ", completion.response)

    send_and_store(ctx, messenger, {
        'chat_id': parsed_message.chatId,
        'kind': "text",
        'body': completion.response
    })

    response_time_ms = int((time.time() - parsed_message.messageTimestamp) * 1000)
    processing_time_ms = int((time.time() - start) * 1000)
    completion_tokens_per_sec = completion.completionTokens / (processing_time_ms / 1000)

    ctx.set_stat('channel', ctx.user_channel)
    ctx.set_stat('prompt_tokens', completion.promptTokens)
    ctx.set_stat('completion_tokens', completion.completionTokens)
    ctx.set_stat('completion_tokens_per_sec', completion_tokens_per_sec)
    ctx.set_stat('total_tokens', completion.promptTokens + completion.completionTokens)
    ctx.set_stat('response_time_ms', response_time_ms)
    ctx.set_stat('processing_time_ms', processing_time_ms)

    ph_props = {
            'senderId': parsed_message.senderId,
    }

    ph_props.update(ctx.stats)

    posthog_capture(
        distinct_id = f'{parsed_message.source}:{parsed_message.chatId}',
        event = 'reply-sent',
        properties = ph_props
    )

def handle_audio_message(ctx, messenger, parsed_message, file_info, in_flight):
    messenger.set_typing(parsed_message.chatId, in_flight)

    transcript = get_transcript(ctx, messenger, parsed_message, file_info)
    text = "\N{SPEAKING HEAD IN SILHOUETTE}\N{MEMO}: " + transcript

    send_attrs = {
        "chat_id": parsed_message.chatId,
        "kind": "text",
        "body": text,
        "quote_id": parsed_message.messageId
    }

    # Designed behavior:
    #
    # Forwarded messages: transcribe and exit
    # Original messages: transcribe and respond

    if parsed_message.isForwarded:
        parsed_message.body = "Please transcribe: <audio.mp3 file>"
        insert_message(ctx, parsed_message)
        send_and_store(ctx, messenger, send_attrs)
    else:
        parsed_message.body = transcript
        # Use messenger.send_message directly, so transcribed reply is not stored in DB
        messenger.send_message(ctx, send_attrs)

    posthog_capture(
        distinct_id = f"{parsed_message.source}:{parsed_message.chatId}",
        event = "message-transcribed",
        properties = {
            'sender_id': parsed_message.senderId,
            'channel': ctx.user_channel,
            'length_in_seconds': -1
        }
    )



def send_intro_message(ctx:Context, messenger, parsed_message):
    intro_message_legal = """Robot 1-X at your service!

First, be aware that while I always do my best to help, I am not a professional doctor, psychologist, banker or otherwise.
Some of my replies may provide incorrect information about people, locations and events.
Always check my suggestions with a professional.


If you're under 18, you must have your parents' permission before you continue talking to me!

Chatting with me means you agree to my Terms of Use (https://r1x.ai/terms-of-use) and Privacy policy (https://r1x.ai/privacy).
Make sure to read them before continuing this chat."""

    intro_message_overview = """Here are some things you can ask me for:

- Write a bedtime story about Abigail and Jonathan, two superheroes who live next to a river.
- Plan a 14-day road trip from Milan to Minsk. Include detailed suggestions about where to spend each day.
- Rewrite the following text with spell-checking and punctuation: pleez send me all the docooments that is need for tomorrow flight im waiting for dem.
- Please summarize the following text: <copy some text/email here>.

And, you can record a message instead of typing!

How can I help?"""

    send_and_store(ctx, messenger, {
        "chat_id": parsed_message["chatId"],
        "kind": "text",
        "body": intro_message_legal
    })

    send_and_store(ctx, messenger, {
        "chat_id": parsed_message["chatId"],
        "kind": "text",
        "body": intro_message_overview
    })

def get_transcript(ctx:Context, messenger, parsed_message, file_info):
    mp3_file_path = None

    audio_root = pathlib.Path(tempfile.gettempdir()) / 'r1x' / 'audio'
    audio_root.mkdir(exist_ok=True)

    with tempfile.TemporaryDirectory(dir=audio_root, ignore_cleanup_errors=True) as workdir:
        mp3_file_path = messenger.get_voice_mp3_file(ctx, parsed_message, file_info, pathlib.Path(workdir))
        transcription = create_transcription(ctx, mp3_file_path)

        return transcription

def send_and_store(ctx: Context, messenger: MessagingService, message_attributes):
    response = messenger.send_message(ctx, message_attributes)

    if response:
        insert_message(ctx, response)
