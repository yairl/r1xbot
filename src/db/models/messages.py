from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class Message(Base):
    __tablename__ = "Messages"

    id = Column(Integer, primary_key=True)
    source = Column(String)
    messageTimestamp = Column(DateTime)
    chatType = Column(String)
    chatId = Column(String)
    senderId = Column(String)
    isSentByMe = Column(Boolean)
    messageId = Column(String)
    replyToMessageId = Column(String)
    kind = Column(String)
    body = Column(Text)
    rawSource = Column(JSON)
    createdAt = Column(DateTime)
    updatedAt = Column(DateTime)    
