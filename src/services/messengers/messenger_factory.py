from typing import Dict
from services.messengers.messenger import MessagingService
from services.messengers.tg import TelegramMessenger
from services.messengers.wa import WhatsappMessenger

messenger_by_type = { 'tg' : TelegramMessenger(), 'wa' : WhatsappMessenger()} # type: Dict[str, MessagingService]
