import threading
from typing import Any, Dict 
from infra import logger


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
    user_channel: str
    user_settings: Dict[str, Any]
    
    def __init__(self):
        self.msg_count = counter.get_and_increment()
        self.logger = logger.create_logging_context(self.msg_count)
    
    def log(self, message:Any, *args:Any) -> None:
        self.logger.log(message, args)
        
