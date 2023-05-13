from sqlalchemy import and_, desc
from src import db_models
import datetime

from src.infra.context import Context

def insert_message(ctx:Context, attributes):
    source = attributes['source']
    message_timestamp = datetime.datetime.fromtimestamp(attributes['messageTimestamp'], tz=datetime.timezone.utc)
    chat_type = attributes['chatType']
    chat_id = attributes['chatId']
    sender_id = attributes['senderId']
    is_sent_by_me = attributes['isSentByMe']
    message_id = attributes['messageId']
    reply_to_message_id = attributes['replyToMessageId']
    kind = attributes['kind']
    body = attributes['body']
    raw_source = attributes['rawSource']

    ctx.log('insertMessage attributes:', attributes)

    with db_models.Session() as session:
        existing_message = session.query(db_models.Message).filter(and_(db_models.Message.chatId == chat_id, db_models.Message.messageId == message_id)).one_or_none()

        if existing_message:
            return existing_message

        now = datetime.datetime.now()

        message = db_models.Message(
            source=source,
            messageTimestamp=message_timestamp,
            chatType=chat_type,
            chatId=chat_id,
            senderId=sender_id,
            isSentByMe=is_sent_by_me,
            messageId=message_id,
            replyToMessageId=reply_to_message_id,
            kind=kind,
            body=body,
            rawSource=raw_source,
            createdAt=now,
            updatedAt=now
        )

        session.add(message)
        session.commit()
        session.refresh(message)

        session.close()

    return message

def get_message_history(ctx:Context, message, options=None):
    if options is None:
        options = {}

    limit = options.get('limit', 20)
    chat_id = message.chatId
    message_timestamp = message.messageTimestamp

    with db_models.Session() as session:
        messages = session.query(db_models.Message) \
                   .filter(and_(db_models.Message.chatId == chat_id, db_models.Message.messageTimestamp <= message_timestamp)) \
                   .order_by(desc(db_models.Message.createdAt)).limit(limit).all()

        session.close()

    return list(reversed(messages))
