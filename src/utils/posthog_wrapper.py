from contextlib import contextmanager
import os
import time
from posthog import Posthog

class PostHog(object):
    posthog_client = Posthog(
        os.environ['POSTHOG_API_KEY'],
        host='https://app.posthog.com'
    )
    
    @classmethod
    def message_transcribed(cls,ctx, parsed_message) -> None:
        cls.posthog_client.capture(
            distinct_id = f"{parsed_message.source}:{parsed_message.chatId}",
            event = "message-transcribed",
            properties = {
                'sender_id': parsed_message.senderId,
                'channel': ctx.user_channel,
                'length_in_seconds': -1
            }
        )
        
    @classmethod
    def reply_sent(cls, ctx, parsed_message, completion, process_start):
        cls.posthog_client.capture(
            distinct_id = f'{parsed_message.source}:{parsed_message.chatId}',
            event = 'reply-sent',
            properties = {
                'senderId': parsed_message.senderId,
                'channel': ctx.user_channel,
                'prompt_tokens': completion.promptTokens,
                'completion_tokens': completion.completionTokens,
                'total_tokens': completion.promptTokens + completion.completionTokens,
                'response_time_ms': int((time.time() - parsed_message.messageTimestamp) * 1000),
                'processing_time_ms': int((time.time() - process_start) * 1000),
            }
        )
        
    @classmethod
    def open_ai_api_call(cls, ctx, action:str, model:str, runtime:int):
        cls.posthog_client.capture(
            distinct_id= 1246,# TODO
            event='open_ai_api_call',
            properties= {
                'action': action,
                'model': model,
                'api_runtime_ms': runtime,
            }
        )

@contextmanager
def capture_open_ai_api_call(ctx, action, model):
    start = time.time()
    yield
    PostHog.open_ai_api_call(ctx, action, model, int((time.time() - start)*1000))