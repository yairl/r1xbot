from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Message(Base):
    __tablename__ = "Message"

    id = Column(Integer, primary_key=True)
    source = Column(String)
    message_timestamp = Column(DateTime)
    chat_type = Column(String)
    chat_id = Column(String)
    sender_id = Column(String)
    is_sent_by_me = Column(Boolean)
    message_id = Column(String)
    reply_to_message_id = Column(String)
    kind = Column(String)
    body = Column(Text)
    raw_source = Column(JSON)

