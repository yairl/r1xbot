import sys
import sqlite3
import logging
import threading

from collections import defaultdict
from typing import DefaultDict, Optional, Set

from telegram import ForceReply, Update, MessageEntity
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, CallbackContext, ExtBot

from whatsapp_api_client_python import API as WAA

(wa_instance_id, wa_token) = eval(open('/home/yair/keys/greenapi.key').read()) 
wa_app = WAA.GreenApi(wa_instance_id, wa_token)

# openai settings
import openai
openai.api_key_path = '/home/yair/keys/openai.key'
openai_model = 'gpt-3.5-turbo'

# OpenAI functions
def generate_gpt_response(text):
    num_in_tokens = 0
    for l in text.split('\n'):
        num_in_tokens += len(l.split(' '))
        if num_in_tokens > 2048:
            return ('Your message is too long, having more than 2048 words.', None)

    r = openai.ChatCompletion.create(
          model=openai_model,
          messages=[
                    {"role": "user", "content": text}
         ]
      )

    return (r.choices[0].message.content, r.usage.total_tokens)

# Database functions
class ThreadLocalConnection:
    def __init__(self, db_path):
        self.db_path = db_path
        self.local = threading.local()

    def get_connection(self):
        if not hasattr(self.local, 'connection'):
            self.local.connection = sqlite3.connect(self.db_path)
        return self.local.connection


def create_database(conn):
    conn.execute('''CREATE TABLE IF NOT EXISTS messages
                    (id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chat_id INTEGER,
                    username TEXT,
                    text TEXT)''')
    conn.commit()


def store_message(conn, chat_id, message_text, username):
    conn.execute("INSERT INTO messages (chat_id, text, username) VALUES (?, ?, ?)",
                 (chat_id, message_text, username))
    conn.commit()

# Bot functions
class ChatData:
    """Custom class for chat_data. Here we store data per message."""

    def __init__(self) -> None:
        self.clicks_per_message: DefaultDict[int, int] = defaultdict(int)


# The [ExtBot, dict, ChatData, dict] is for type checkers like mypy
class CustomContext(CallbackContext[ExtBot, dict, ChatData, dict]):
    """Custom class for context."""

    def __init__(self, application: Application, chat_id: int = None, user_id: int = None):
        super().__init__(application=application, chat_id=chat_id, user_id=user_id)
        self._message_id: Optional[int] = None

    @property
    def bot_user_ids(self) -> Set[int]:
        """Custom shortcut to access a value stored in the bot_data dict"""
        return self.bot_data.setdefault("user_ids", set())

    @property
    def message_clicks(self) -> Optional[int]:
        """Access the number of clicks for the message this context object was built for."""
        if self._message_id:
            return self.chat_data.clicks_per_message[self._message_id]
        return None

    @message_clicks.setter
    def message_clicks(self, value: int) -> None:
        """Allow to change the count"""
        if not self._message_id:
            raise RuntimeError("There is no message associated with this context object.")
        self.chat_data.clicks_per_message[self._message_id] = value

    @classmethod
    def from_update(cls, update: object, application: "Application") -> "CustomContext":
        """Override from_update to set _message_id."""
        # Make sure to call super()
        context = super().from_update(update, application)

        if context.chat_data and isinstance(update, Update) and update.effective_message:
            # pylint: disable=protected-access
            context._message_id = update.effective_message.message_id

        # Remember to return the object
        return context


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    await update.message.reply_html(
        rf"Hi {user.mention_html()}!",
        reply_markup=ForceReply(selective=True),
    )

async def echo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    message = update.message
    chat_id = message.chat_id
    message_text = message.text
    username = message.from_user.username

    print(context.bot_data)

    #conn = context.bot_data.get_connection()

    #store_message(conn, chat_id, message_text, username)

    print('Private message? ', message.chat.type == "private")
    print('Has mentions? ', message.entities and any(entity.type == MessageEntity.MENTION for entity in message.entities))

    if message.chat.type == "private" or message.entities and any(entity.type == MessageEntity.MENTION for entity in message.entities):
        (reply_text, total_tokens) = generate_gpt_response(message_text)
        await update.message.reply_text('Model: %s, Total tokens: %d, Cost: %f$' % (openai_model, total_tokens, total_tokens * 0.002 / 1000))
        await update.message.reply_text(reply_text)

def wa_handle_incoming_message(body):
    chat_id = body['senderData']['chatId']

    print(body)

    md = body['messageData']
    if 'extendedTextMessageData' in md:
        text = md['extendedTextMessageData']['text']
    else:
        text = md['textMessageData']['textMessage']


    # For group chats, only reply if directly talked to
    if chat_id.endswith('g.us'):
        if not text.startswith('@420720604304'):
            return

        text = text.removeprefix('@420720604304').strip()

    (reply_text, total_tokens) = generate_gpt_response(text)

    print(reply_text)
    print(total_tokens)

    if total_tokens != None:
        wa_app.sending.sendMessage(chat_id, 'Model: %s, Total tokens: %d, Cost: %f$' % (openai_model, total_tokens, total_tokens * 0.002 / 1000))

    wa_app.sending.sendMessage(chat_id, reply_text)


def wa_on_event(webhook_type, body):
    print(body)

    if webhook_type == 'incomingMessageReceived':
        wa_handle_incoming_message(body)

def telegram_run_polling(application):
    print(application)
    application.run_polling()

def wa_run_polling(wa_app):
    wa_app.webhooks.startReceivingNotifications(wa_on_event)

def main():
    logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

    # Replace 'your_bot_token' with the token you received from BotFather
    bot_token = open('/home/yair/keys/telegram_r1xbot.key').read()

    if len(sys.argv) < 2:
        print("Usage: python bot.py <local|remote>")
        sys.exit(1)

    if sys.argv[1] == "local":
        db_path = 'messages.db'
    elif sys.argv[1] == "remote":
        db_path = 'REMOTE_DATABASE_URL'  # Replace with your remote database URL
    else:
        print("Invalid database option. Use 'local' or 'remote'.")
        sys.exit(1)

    conn = ThreadLocalConnection(db_path)
    create_database(conn.get_connection())

    context_types = ContextTypes(context=CustomContext)
    application = Application.builder().token(bot_token).context_types(context_types).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, echo))

    #t_thread = threading.Thread(target=telegram_run_polling, args=(application,))
    #t_thread.start()

    w_thread = threading.Thread(target=wa_run_polling, args=(wa_app,))
    w_thread.start()

    #t_thread.join()
    w_thread.join()

if __name__ == '__main__':
    logging.getLogger("requests").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    main()

