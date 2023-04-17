#!/usr/bin/python3

import dotenv
import numpy
import os
import psycopg2
import psycopg2.extras

START_DATE='2023/04/16'
END_DATE='2023/04/16'

dotenv.load_dotenv('.env.prod')
ps = psycopg2.connect(os.environ['DB_CONNECTION_STRING'])

cur = ps.cursor(cursor_factory=psycopg2.extras.DictCursor)

def get_message_count(start_date, end_date):
    cur = ps.cursor(cursor_factory=psycopg2.extras.DictCursor)

    cur.execute('''SELECT COUNT(id) FROM "Messages" WHERE DATE("createdAt") >= '%s' AND DATE("createdAt") <= '%s';''' % (start_date, end_date))
    message_count = cur.fetchall()[0][0]

    return message_count

def get_active_chats_count(start_date, end_date):
    cur = ps.cursor(cursor_factory=psycopg2.extras.DictCursor)

    cur.execute('''SELECT COUNT(DISTINCT (source, "chatId")) FROM "Messages" WHERE DATE("createdAt") >= '%s' AND DATE("createdAt") <= '%s';''' % (start_date, end_date))
    active_chat_count = cur.fetchall()[0][0]

    return active_chat_count

def get_active_chat_histogram(start_date, end_date):
    cur = ps.cursor(cursor_factory=psycopg2.extras.DictCursor)

    cur.execute('''SELECT "chatId", chat_id_count FROM (SELECT "chatId", COUNT(*) as chat_id_count FROM "Messages" WHERE DATE("createdAt") >= '%s' AND DATE("createdAt") <= '%s' GROUP BY "chatId") AS chat_count_table ORDER BY chat_id_count DESC;''' % (start_date, end_date))

    chats = []
    for member in cur.fetchall():
        chats.append(member)

    return chats

num_msgs = get_message_count(START_DATE, END_DATE)
print('Number of messages: ', num_msgs)

chats = get_active_chat_histogram(START_DATE, END_DATE)
print('Active chats today: ', len(chats))

msg_arr = []

for chat in chats:
    (chat_id, msgs) = chat
    msg_arr.append(msgs)
    if msgs < 100:
        continue
    
    #print(chat_id, msgs)

print(numpy.histogram(msg_arr, [0, 5, 10, 15, 20, 50, 100]))

