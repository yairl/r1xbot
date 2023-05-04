from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id = Column(String, primary_key=True)
    settings = Column(JSONB)
    version = Column(Integer)
    createdAt = Column(DateTime)
