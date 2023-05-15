from contextlib import contextmanager
import os
import time
from posthog import Posthog

from src.infra.context import Context

class EventLogger(object):
    posthog_client = Posthog(
        os.environ['POSTHOG_API_KEY'],
        host='https://app.posthog.com'
    )
    
    @classmethod
    def message_transcribed(cls,ctx:Context, parsed_message) -> None:
        cls.posthog_client.capture(
            distinct_id = ctx.distinct_user_id,
            event = "message-transcribed",
            properties = {
                'sender_id': parsed_message.senderId,
                'channel': ctx.user_channel,
                'length_in_seconds': -1
            }
        )
        
    @classmethod
    def reply_sent(cls, ctx:Context, parsed_message, completion, process_start:float):
        processing_time_ms = int((time.time() - process_start) * 1000)
        properties = {
                'senderId': parsed_message.senderId,
                'channel': ctx.user_channel,
                'prompt_tokens': completion.promptTokens,
                'completion_tokens': completion.completionTokens,
                'completion_tokens_per_sec': completion.completionTokens / (processing_time_ms / 1000),
                'total_tokens': completion.promptTokens + completion.completionTokens,
                'response_time_ms': int((time.time() - parsed_message.messageTimestamp) * 1000),
                'processing_time_ms': processing_time_ms,
            }
        properties.update(ctx.posthog_stats)
        cls.posthog_client.capture(
            distinct_id = ctx.distinct_user_id,
            event = 'reply-sent',
            properties = properties
        )
        
        
@contextmanager
def capture_call(ctx:Context, action:str):
    start = time.time()
    yield
    ctx.posthog_stats.update({action:int((time.time() - start)*1000)})