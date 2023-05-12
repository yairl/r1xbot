from src.services.messengers.messenger import MessagingService
from src.services.messengers.tg import TelegramMessenger
from src.services.messengers.wa import WhatsappMessenger

messenger_by_type = { 'tg' : TelegramMessenger(), 'wa' : WhatsappMessenger()}
