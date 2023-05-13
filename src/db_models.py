# coding: utf-8
import os

from sqlalchemy import create_engine
from sqlalchemy import Boolean, Column, DateTime, Index, Integer, JSON, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.engine.url import URL

### Start of table definitions ###

Base = declarative_base()
metadata = Base.metadata

class Message(Base):
    __tablename__ = 'Messages'
    __table_args__ = (
        Index('index_on_messages_chat_id_message_id', 'chatId', 'messageId', unique=True),
        Index('index_on_messages_created_at_chat_id', 'createdAt', 'chatId')
    )

    id = Column(Integer, primary_key=True, server_default=text("""nextval('"Messages_id_seq"'::regclass)"""))
    source = Column(String(255))
    messageTimestamp = Column(DateTime(True))
    chatType = Column(String(255))
    chatId = Column(String(255))
    senderId = Column(String(255))
    isSentByMe = Column(Boolean)
    messageId = Column(String(255))
    replyToMessageId = Column(String(255))
    kind = Column(String(255))
    body = Column(Text)
    rawSource = Column(JSON)
    createdAt = Column(DateTime(True), nullable=False)
    updatedAt = Column(DateTime(True), nullable=False)


class SequelizeMeta(Base):
    __tablename__ = 'SequelizeMeta'

    name = Column(String(255), primary_key=True)


class UserSettings(Base):
    __tablename__ = 'user_settings'

    id = Column(Integer, primary_key=True, server_default=text("nextval('user_settings_id_seq'::regclass)"))
    user_id = Column(String(255), nullable=False, index=True)
    settings = Column(JSONB, nullable=False)
    version = Column(Integer, nullable=False)
    createdAt = Column(DateTime(True), nullable=False, index=True)
    updatedAt = Column(DateTime(True), nullable=False)

### End of table definitions ###

# Set up the database connection
engine = create_engine(os.environ['DB_CONNECTION_STRING'])

# Create a session factory
Session = sessionmaker(bind=engine)

# Register models
Base.metadata.create_all(engine)
