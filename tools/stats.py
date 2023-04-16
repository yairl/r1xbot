#!/usr/bin/python3

import dotenv
import os
import psycopg2
import psycopg2.extras

START_DATE='2023/04/16'

dotenv.load_dotenv('.env.prod')
ps = psycopg2.connect(os.environ['DB_CONNECTION_STRING'])

cur = ps.cursor(cursor_factory=psycopg2.extras.DictCursor)

cur.execute('''SELECT COUNT(id) FROM "Messages" WHERE DATE("createdAt") >= '%s';''' % START_DATE)
message_count = cur.fetchall()[0][0]
print('Overall messages today: ', message_count)

cur.execute('''SELECT COUNT(DISTINCT (source, "chatId")) FROM "Messages" WHERE DATE("createdAt") >= '%s';''' % START_DATE)
chat_count = cur.fetchall()[0][0]
print('Active chats today: ', chat_count)

cur.execute('''SELECT "chatId", chat_id_count FROM (SELECT "chatId", COUNT(*) as chat_id_count FROM "Messages" WHERE DATE("createdAt") >= '%s' GROUP BY "chatId") AS chat_count_table WHERE chat_id_count > 10 ORDER BY chat_id_count DESC;''' % START_DATE)

num_long_active_chats = 0
for member in cur.fetchall():
    print(member)
    num_long_active_chats += 1

print('Active chats today (>10): ', num_long_active_chats)


