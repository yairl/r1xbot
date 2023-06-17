from typing import Dict, Tuple
from services.messengers.messenger import MessagingService
from services.messengers.tg import TelegramMessenger
from services.messengers.wa import WhatsappMessenger

messenger_by_type: Dict[str, MessagingService] = {'tg': TelegramMessenger, 'wa': WhatsappMessenger}


def make_messenger(messenger_chat_id: str) -> Tuple[MessagingService, str]:
    messenger_str, chat_id = messenger_chat_id.split(":")
    messenger = messenger_by_type[messenger_str](chat_id)
    return messenger

