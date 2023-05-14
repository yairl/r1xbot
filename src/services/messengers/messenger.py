from abc import ABC, abstractmethod
from typing import List, Tuple

from box import Box
from src.infra.context import Context


class MessageKindE:
    TEXT = 'text'
    VOICE = 'voice'
    AUDIO = 'audio'

class MessagingService(ABC):
    def multi_send(self, ctx:Context, chat_ids: List[str], attributes ):
        for chat_id in chat_ids:
            attributes['chat_id'] = chat_id
            self.send_message_raw(ctx, attributes)
    
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