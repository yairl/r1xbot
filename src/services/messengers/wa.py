import os
from typing import Dict
import requests
from services.messengers.messenger import MessageKindE, MessagingService
from infra import utils
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

        message0 = message['entry'][0]['changes'][0]['value']['messages'][0]

        kind = self._get_message_kind(message0)
        message_timestamp = float(message0['timestamp'])
        sender_id = self.chat_id
        chat_type = "private"
        is_sent_by_me = sender_id == os.environ['WHATSAPP_PHONE_NUMBER']
        is_forwarded = (message0.get('context', {}).get('forwarded', None) != None)
        message_id = message0['id']
        reply_to_message_id = message0.get('context', {}).get('id')

        if kind == MessageKindE.TEXT:
            body = message0['text']['body']
        else:
            body = None

        if kind == MessageKindE.VOICE:
            file_id = message0['audio']['id']
        else:
            file_id = None

        file_unique_id = None

        return [Box({
            "source": source,
            "messageTimestamp": message_timestamp,
            "chatType": chat_type,
            "chatId": self.chat_id,
            "senderId": sender_id,
            "isSentByMe": is_sent_by_me,
            "isForwarded" : is_forwarded,
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
        quote_id = attributes.get('quote_id')
        kind = attributes.get('kind')
        body = attributes.get('body')

        if kind != "text":
            return

        if len(body) > 4000:
            ctx.log('send_message: message body too long, %d > 4000' % len(body))
            body = body[0:3999]

        headers = {
            "Authorization": f"Bearer {os.environ['WHATSAPP_BOT_TOKEN']}",
            "Content-Type": "application/json"
        }

        args = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": self.chat_id,
            "type": "text",
            "text": {
                "preview_url": False,
                "body": body
            }
        }

        if quote_id:
            args["context"] = {"message_id": quote_id}

        response = self._post_message_request(ctx, headers, args)

        if response == None:
            return None

        message = self._get_bot_generated_message(ctx, response.json(), attributes)
        parsed_message, _ = self.parse_message(message)
        parsed_message.chatId = self.chat_id

        return parsed_message

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
    
    def send_contact(self, ctx: Context, name:str, handle:str):
        headers = {
            "Authorization": f"Bearer {os.environ['WHATSAPP_BOT_TOKEN']}",
            "Content-Type": "application/json"
        }
        contact_args = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": self.chat_id,
            "type": "contacts",
            "contacts": [
                {
                    "addresses": [],
                    "emails": [],
                    "name": {
                        "first_name": name,
                        "formatted_name": name,
                        "last_name": ""
                    },
                    "org": {},
                    "phones": [
                        {
                            "phone": f"+{handle}",
                            "type": "HOME",
                            "wa_id": handle
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
        orig_file_path, mp3_file_path = self._get_audio_file_paths(ctx, parsed_message.chatId, file_info, work_dir)

        headers = {
            "Authorization": f"Bearer {os.environ['WHATSAPP_BOT_TOKEN']}",
        }

        utils.download_stream_file(ctx, url, orig_file_path, headers)
        utils.convert_audio_to_mp3(ctx, orig_file_path, mp3_file_path)

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
        orig_file_path = work_dir / 'audio.orig'
        mp3_file_path = work_dir / 'audio.mp3'

        ctx.log(f"getAudioFilePaths: orgFilePath={orig_file_path}, mp3FilePath={mp3_file_path}")

        return orig_file_path, mp3_file_path


    def set_typing(self, in_flight):
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
