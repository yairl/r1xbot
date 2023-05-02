from sqlalchemy import and_, desc
from db.models import Message

def insert_message(ctx, attributes):
    source = attributes['source']
    message_timestamp = attributes['messageTimestamp']
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

    with ctx.Session() as session:
        existing_message = session.execute(
            session.query(Message).filter_by(chat_id=chat_id, message_id=message_id).one_or_none()
        )

        if existing_message:
            return existing_message

        message = Message(
            source=source,
            message_timestamp=message_timestamp,
            chat_type=chat_type,
            chat_id=chat_id,
            sender_id=sender_id,
            is_sent_by_me=is_sent_by_me,
            message_id=message_id,
            reply_to_message_id=reply_to_message_id,
            kind=kind,
            body=body,
            raw_source=raw_source
        )

        session.add(message)
        session.commit()
        session.refresh(message)

    return message

def get_message_history(ctx, message, options=None):
    if options is None:
        options = {}

    limit = options.get('limit', 20)
    chat_id = message.chat_id
    message_timestamp = message.message_timestamp

    with ctx.Session() as session:
        messages = session.execute(
            session.query(Message).filter(
                and_(Message.chat_id == chat_id, Message.message_timestamp <= message_timestamp)
            ).order_by(desc(Message.created_at)).limit(limit)
        )

    return list(reversed(messages))
