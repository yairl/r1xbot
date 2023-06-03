# coding: utf-8
import os

import sqlalchemy
from sqlalchemy import create_engine, func
from sqlalchemy import Boolean, Column, DateTime, Index, Integer, JSON, String, Text, text, TypeDecorator
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.engine.url import URL

# JSONB is not supported by SQLite, but is supported by PostgreSQL.
# DialectAdapter selects the right one is used per database type.
class DialectAdapter(TypeDecorator):
    impl = JSON

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(JSONB())
        else:
            return dialect.type_descriptor(JSON())

### Start of table definitions ###

Base = declarative_base()
metadata = Base.metadata

class Message(Base):
    __tablename__ = 'Messages'
    __table_args__ = (
        Index('index_on_messages_chat_id_message_id', 'chatId', 'messageId', unique=True),
        Index('index_on_messages_created_at_chat_id', 'createdAt', 'chatId')
    )

    id = Column(Integer, primary_key=True)
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

    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)
    settings = Column(DialectAdapter, nullable=False)
    version = Column(Integer, nullable=False)
    createdAt = Column(DateTime(True), nullable=False, index=True)
    updatedAt = Column(DateTime(True), nullable=False)

class Event(Base):
    __tablename__ = 'events'

    id = Column(Integer, primary_key=True)
    type = Column(String)
    ref_table = Column(String)
    ref_id = Column(Integer)
    body = Column(DialectAdapter)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    __table_args__ = (
        sqlalchemy.Index('ix_events_type', 'type'),
        sqlalchemy.Index('ix_events_ref', 'ref_table', 'ref_id'),
    )

class Timer(Base):
    __tablename__ = 'timers'

    id = Column(Integer, primary_key=True)
    chat_id = Column(String, index=True)
    trigger_timestamp = Column(DateTime, index=True)
    data = Column(DialectAdapter)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)

### End of table definitions ###

# Set up the database connection
engine = create_engine(os.environ['DB_CONNECTION_STRING'])

# Create a session factory
Session = sessionmaker(bind=engine)

# Register models
Base.metadata.create_all(engine)
