import os
from typing import Dict
import requests
from services.messengers.messenger import MessageKindE, MessagingService
from utils import download_services, media_converters
from services.messages import messages_service
from box import Box
import time

from infra.context import Context

class EventKindE:
    STATUS_UPDATE = 'status_update'
    MESSAGE = 'message'
    

class WhatsappMessenger(MessagingService):
    def _get_event_kind(self, value):
        if 'statuses' in value:
            return EventKindE.STATUS_UPDATE
        if 'messages' in value:
            return EventKindE.MESSAGE
        return None

    def _get_message_kind(self, value) -> str:
        if value['type'] == 'audio':
            return MessageKindE.VOICE
        return value['type']

    def parse_message(self, message):
        source = "wa"
        event_kind = self._get_event_kind(message['entry'][0]['changes'][0]['value'])
        if event_kind != EventKindE.MESSAGE:
            return None

        kind = self._get_message_kind(message['entry'][0]['changes'][0]['value']['messages'][0])
        message_timestamp = float(message['entry'][0]['changes'][0]['value']['messages'][0]['timestamp'])
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

        return [Box({
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
        }), Box({
            "fileId": file_id,
            "fileUniqueId": file_unique_id
        })]

    def _get_bot_generated_message(self, ctx:Context, send_message_response, attributes):
        chat_id = attributes.get('chat_id')
        quote_id = attributes.get('quote_id')
        kind = attributes.get('kind')
        body = attributes.get('body')

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
                                        "id": send_message_response['messages'][0]['id'],
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

    def send_message(self, ctx:Context, attributes):
        chat_id = attributes.get('chat_id')
        response = self.send_message_raw(ctx, attributes)

        if response:
            message = self._get_bot_generated_message(ctx, response, attributes)
            parsed_message, _ = self.parse_message(message)

            parsed_message.chatId = chat_id
            ctx.log(parsed_message)

            messages_service.insert_message(ctx, parsed_message)
            ctx.log(f"Message inserted successfully: {parsed_message}")

    def send_message_raw(self, ctx:Context, attributes):
        chat_id = attributes.get('chat_id')
        quote_id = attributes.get('quote_id')
        kind = attributes.get('kind')
        body = attributes.get('body')

        if kind != "text":
            return

        if len(body) > 4000:
            ctx.log('send_message_raw: message body too long, %d > 4000' % len(body))
            body = body[0:3999]

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

        response = self._post_message_request(ctx, headers, args)

        return response.json()

    def _post_message_request(self, ctx:Context, headers:Dict[str,str], args):
        try:
            response = requests.post(
                f"https://graph.facebook.com/{os.environ['FACEBOOK_GRAPH_VERSION']}/{os.environ['WHATSAPP_PHONE_NUMBER_ID']}/messages",
                json=args,
                headers=headers
            )
            response.raise_for_status()
        except requests.exceptions.RequestException as error:
            ctx.log(f"post_message_request: exception. error={error}")
            raise error
        return response
    
    def send_bot_contact(self, ctx: Context, chat_id:str):
        headers = {
            "Authorization": f"Bearer {os.environ['WHATSAPP_BOT_TOKEN']}",
            "Content-Type": "application/json"
        }
        contact_args = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": chat_id,
            "type": "contacts",
            "contacts": [
                {
                    "addresses": [],
                    "emails": [],
                    "name": {
                        "first_name": "Robot 1-X",
                        "formatted_name": "Robot 1-X",
                        "last_name": ""
                    },
                    "org": {},
                    "phones": [
                        {
                            "phone": f"+{os.environ['WHATSAPP_PHONE_NUMBER']}",
                            "type": "HOME",
                            "wa_id": os.environ['WHATSAPP_PHONE_NUMBER']
                        }
                    ],
                    "urls": []
                }
            ]
        }
        response = self._post_message_request(ctx,headers,contact_args)
        return response.json()     

    def is_message_for_me(self, msg) -> bool:
        if msg.chatType == "private":
            return True

        return False

    def get_voice_mp3_file(self, ctx:Context, parsed_message, file_info, work_dir) -> str:
        ctx.log(f"getVoiceMp3File: {parsed_message}, {file_info}, {work_dir}")
        url = self._get_download_url(ctx, file_info.fileId)
        ogg_file_path, mp3_file_path = self._get_audio_file_paths(ctx, parsed_message.chatId, file_info, work_dir)

        headers = {
            "Authorization": f"Bearer {os.environ['WHATSAPP_BOT_TOKEN']}",
        }

        download_services.download_stream_file(ctx, url, ogg_file_path, headers)
        media_converters.convert_ogg_to_mp3(ctx, ogg_file_path, mp3_file_path)

        return mp3_file_path

    def _get_download_url(self, ctx:Context, file_id):
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
            ctx.log(f"getDownloadUrl: exception. error={error}")
            raise error

        download_url = response.json()['url']

        ctx.log(f"getDownloadUrl: downloadUrl={download_url}")
        return download_url

    def _get_audio_file_paths(self, ctx:Context, chat_id, file_info, work_dir):
        ogg_file_path = work_dir / 'audio.ogg'
        mp3_file_path = work_dir / 'audio.mp3'

        ctx.log(f"getAudioFilePaths: oggFilePath={ogg_file_path}, mp3FilePath={mp3_file_path}")

        return ogg_file_path, mp3_file_path


    def set_typing(self, chat_id, in_flight):
        # TODO: igors - can't find WA API for typing indication.
        pass


    def set_status_read(self, ctx:Context, message_id):
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
            ctx.log(f"setStatusRead: exception. error={error}")
            return

        if response.json().get('success') != True:
            ctx.log(f"setStatusRead: response is wrong. Compared field {response.json().get('success')}. Full response {response}")
