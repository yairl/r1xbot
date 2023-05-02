import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.engine.url import URL

Base = declarative_base()

# Get environment variables and configurations
env = os.getenv("NODE_ENV", "development")
config = {}
with open(os.path.join(os.path.dirname(__file__), "../config/db-config.json"), "r") as f:
    config = json.load(f)[env]

# Set up the database connection
if "use_env_variable" in config:
    engine = create_engine(os.environ[config["use_env_variable"]])
else:
    database_url = URL(
        drivername=config["dialect"],
        username=config["username"],
        password=config["password"],
        host=config["host"],
        port=config["port"],
        database=config["database"],
    )
    engine = create_engine(database_url)

# Create a session factory
Session = sessionmaker(bind=engine)

# Import and register models
from .message import Message
from .user_settings import UserSettings

Base.metadata.create_all(engine)

db = {
    "Base": Base,
    "Session": Session,
    "engine": engine,
}

