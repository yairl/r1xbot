from abc import ABC, abstractmethod
from typing import Tuple

from box import Box

from src.infra.context import Context


class MessageKindE:
    TEXT = 'text'
    VOICE = 'voice'
    AUDIO = 'audio'

class MessagingService(ABC):
    @abstractmethod
    def parse_message(self, message) -> Tuple[Box, Box]:
        pass

    @abstractmethod
    def send_message(self, ctx:Context, attributes) -> None:
        pass

    @abstractmethod
    def send_message_raw(self, ctx:Context, attributes):
        pass
    
    
    @abstractmethod
    def send_bot_contact(self, ctx:Context, attributes):
        pass
    
    @abstractmethod
    def is_message_for_me(self, message) -> bool:
        pass

    @abstractmethod
    def set_typing(self, chat_id, in_flight) ->None:
        pass

    @abstractmethod
    def get_voice_mp3_file(self, ctx:Context, parsed_message, file_info) -> str:
        pass

    @abstractmethod
    def set_status_read(self, ctx:Context, message_id) -> None:
        pass