from abc import ABC, abstractmethod
from typing import Tuple

from box import Box

from infra.context import Context


class MessageKindE:
    TEXT = 'text'
    VOICE = 'voice'
    AUDIO = 'audio'


class MessagingService(ABC):
    def __init__(self, chat_id: str):
        super().__init__()
        self.chat_id = chat_id

    @abstractmethod
    def parse_message(self, message) -> Tuple[Box, Box]:
        pass

    @abstractmethod
    def send_message(self, ctx:Context, attributes) -> Box:
        pass
    
    @abstractmethod
    def send_contact(self, ctx:Context, name:str, handle:str):
        pass
    
    @abstractmethod
    def is_message_for_me(self, message) -> bool:
        pass

    @abstractmethod
    def set_typing(self, in_flight) ->None:
        pass

    @abstractmethod
    def get_voice_mp3_file(self, ctx:Context, parsed_message, file_info, work_dir) -> str:
        pass

    @abstractmethod
    def set_status_read(self, ctx:Context, message_id) -> None:
        pass