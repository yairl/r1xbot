from typing import Dict, Tuple
from services.messengers.messenger import MessagingService
from services.messengers.tg import TelegramMessenger
from services.messengers.wa import WhatsappMessenger

messenger_by_type = { 'tg' : TelegramMessenger(), 'wa' : WhatsappMessenger()} # type: Dict[str, MessagingService]

def get_messenger_and_chat_id(messenger_chat_id:str) -> Tuple[MessagingService, str]:
    messenger_str, chat_id = messenger_chat_id.split(":")
    messenger = messenger_by_type[messenger_str]
    return messenger, chat_id

