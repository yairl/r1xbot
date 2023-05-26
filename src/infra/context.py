import threading
from typing import Any, Dict, Union
from utils import logger


class ThreadSafeCounter:
    def __init__(self):
        self._counter = 0
        self._lock = threading.Lock()

    def get_and_increment(self):
        with self._lock:
            val = self._counter
            self._counter += 1
            return val

# Usage
counter = ThreadSafeCounter()

class Context(object):  
    def __init__(self):
        self.user_channel = None    # type: str
        self.user_settings = {}     # type: Dict[str, Any]

        self.msg_count = counter.get_and_increment()
        self.logger = logger.create_logging_context(self.msg_count)

        self.stats = {}
    
    def log(self, message:Any, *args:Any) -> None:
        self.logger.log(message, args)
        
    def set_stat(self, key: str, value: Union[int, bool, float, str]):
        self.stats[key] = value
