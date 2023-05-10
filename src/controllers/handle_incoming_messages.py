import time
import json
import os

from src.services.open_ai.query_openai import get_chat_completion, get_chat_completion_with_tools, create_transcription
from src.db.models.user_settings import UserSettings
from src.services.messages.messages_service import insert_message, get_message_history
import src.services.messengers as messengers
from src.utils import file_services

from posthog import Posthog
import src.db.models.index as db_index
from sqlalchemy import desc

posthog_client = Posthog(
    os.environ['POSTHOG_API_KEY'],
    host='https://app.posthog.com'
)

def get_user_channel(parsed_message):
    user_id = f"{parsed_message.source}:{parsed_message.chatId}"
    session = db_index.Session()
    settings = session.query(UserSettings) \
                .filter(UserSettings.user_id == user_id) \
                .order_by(desc(UserSettings.createdAt)) \
                .limit(1) \
                .one_or_none()

    channel = settings.settings['channel'] if settings else 'stable'

    session.close()

    return channel


def handle_incoming_message(ctx, event):
    in_flight = {"working": True}

    try:
        handle_incoming_message_core(ctx, event, in_flight)
    except Exception as error:
        ctx.log("Message processing failed: ", error.stack, error)
        raise Exception("Message processing failed.")
    finally:
        in_flight["working"] = False


def handle_incoming_message_core(ctx, event, in_flight):
    start = time.time()
    parsed_event = json.loads(event)
    messenger = messengers.__all__[parsed_event["source"]]

    parse_message_result = messenger.parse_message(parsed_event["event"])

    if parse_message_result is None:
        return

    parsed_message, file_info = parse_message_result

    messenger.set_status_read(ctx, parsed_message.messageId)

    ctx.user_channel = get_user_channel(parsed_message)

    is_typing = False

    if parsed_message.kind == "voice":
        messenger.set_typing(parsed_message.chatId, in_flight)
        is_typing = True

        parsed_message.body = get_transcript(ctx, messenger, parsed_message, file_info)

        quote_transcription, unused_reply_to_voice_message = get_voice_message_actions(messenger.is_message_for_me(parsed_message))

        if quote_transcription:
            prefix_text = "\N{SPEAKING HEAD IN SILHOUETTE}\N{MEMO}: "

            messenger.send_message_raw(ctx, {
                "chat_id": parsed_message.chatId,
                "kind": "text",
                "body": prefix_text + parsed_message.body,
                "quote_id": parsed_message.messageId
            })

        posthog_client.capture(
            distinct_id = f"{parsed_message.source}:{parsed_message.chatId}",
            event = "message-transcribed",
            properties = {
                'sender_id': parsed_message.senderId,
                'channel': ctx.user_channel,
                'length_in_seconds': -1
            }
        )

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
    completion = get_chat_completion_with_tools(ctx, messenger_name, message_history, False) if ctx.user_channel == "canary" else get_chat_completion(ctx, messenger_name, message_history, False)

    ctx.log({"completion": completion})
    ctx.log("get_chat_completion done, result is ", completion.response)

    messenger.send_message(ctx, {
        'chat_id': parsed_message.chatId,
        'kind': "text",
        'body': completion.response
    });
    posthog_client.capture(
        distinct_id = f'{parsed_message.source}:{parsed_message.chatId}',
        event = 'reply-sent',
        properties = {
            'senderId': parsed_message.senderId,
            'channel': ctx.user_channel,
            'prompt_tokens': completion.promptTokens,
            'completion_tokens': completion.completionTokens,
            'total_tokens': completion.promptTokens + completion.completionTokens,
            'response_time_ms': int((time.time() - parsed_message.messageTimestamp) * 1000),
            'processing_time_ms': int((time.time() - start) * 1000),
        }
    )

def send_intro_message(ctx, messenger, parsed_message):
    intro_message_legal = """Robot 1-X at your service!

First, be aware that while I always do my best to help, I am not a professional doctor, psychologist, banker or otherwise.
Some of my replies may provide incorrect information about people, locations and events.
Always check my suggestions with a professional.


If you're under 18, you must have your parents' permission before you continue talking to me!

Chatting with me means you agree to my Terms of Use (https://r1x.ai/terms-of-use) and Privacy policy (https://r1x.ai/privacy).
Make sure to read them before continuing this chat."""

    intro_message_overview = """Phew, now that that's out of the way, here are some things you can ask me for:

- Write a bedtime story about Abigail and Jonathan, two superheroes who live next to a river.
- Plan a 14-day road trip from Milan to Minsk. Include detailed suggestions about where to spend each day.
- Rewrite the following text with spell-checking and punctuation: pleez send me all the docooments that is need for tomorrow flight im waiting for dem.
- Please summarize the following text: <copy some text/email here>.

And, you can send me an audio message instead of typing!

How can I help?"""

    messenger.send_message(ctx, {
        "chat_id": parsed_message["chatId"],
        "kind": "text",
        "body": intro_message_legal
    })

    messenger.send_message(ctx, {
        "chat_id": parsed_message["chatId"],
        "kind": "text",
        "body": intro_message_overview
    })

def get_transcript(ctx, messenger, parsed_message, file_info):
    mp3_file_path = None

    try:
        mp3_file_path = messenger.get_voice_mp3_file(ctx, parsed_message, file_info)
        transcription = create_transcription(ctx, mp3_file_path)
        return transcription
    finally:
        if mp3_file_path:
            file_services.delete_file(ctx, mp3_file_path)

def get_voice_message_actions(is_message_to_me):
    quote_transcription = True
    unused_reply_to_voice_message = None
    return [quote_transcription, unused_reply_to_voice_message]
