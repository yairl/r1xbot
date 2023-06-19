from typing import Dict, Tuple, Optional, Type, Callable
from services.messengers.messenger import MessagingService
from services.messengers.tg import TelegramMessenger
from services.messengers.wa import WhatsappMessenger

messenger_by_type: Dict[str, Type[MessagingService]] = {'tg': TelegramMessenger, 'wa': WhatsappMessenger}


def make_messenger(messenger_chat_id: str) -> MessagingService:
    messenger_str, chat_id = messenger_chat_id.split(":")
    messenger = messenger_by_type[messenger_str](chat_id)
    return messenger


def _make_wa_messenger_from_event(event: Dict) -> Optional[MessagingService]:
    entry_changes0 = event['event']['entry'][0]['changes'][0]['value']
    if 'messages' not in entry_changes0:
        # not a message event.
        return None

    chat_id = entry_changes0['messages'][0]['from']
    messenger = messenger_by_type[event['source']](chat_id)
    return messenger


def _make_tg_messenger_from_event(event: Dict) -> MessagingService:
    chat_id = str(event['event']['message']['chat']['id'])
    messenger = messenger_by_type[event['source']](chat_id)
    return messenger


messenger_factory_by_type: Dict[str, Callable] = {'tg': _make_tg_messenger_from_event, 'wa': _make_wa_messenger_from_event}


def make_messenger_from_event(event: Dict) -> Optional[MessagingService]:
    messenger = messenger_factory_by_type[event['source']](event)
    return messenger
