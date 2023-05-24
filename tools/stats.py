#!/usr/bin/python3

import argparse
import dotenv
import numpy
import os
import psycopg2
import psycopg2.extras

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

    # Select <source>:<chat>, so this data can be used later to send messages to specific users.
    cur.execute('''SELECT source, "chatId", chat_id_count FROM (SELECT source, "chatId", COUNT(*) as chat_id_count FROM "Messages" WHERE DATE("createdAt") >= '%s' AND DATE("createdAt") <= '%s' GROUP BY source, "chatId") AS chat_count_table ORDER BY chat_id_count DESC;''' % (start_date, end_date))

    chats = []
    for member in cur.fetchall():
        chats.append(member)

    return chats

parser = argparse.ArgumentParser(description='Fetch statistics from R1X database.')
parser.add_argument('--start-date', type=str, dest='start_date', help='Start date.', required=True)
parser.add_argument('--end-date', type=str, dest='end_date', help='End date.', required=True)
args = parser.parse_args()

num_msgs = get_message_count(args.start_date, args.end_date)
print('Number of messages: ', num_msgs)

chats = get_active_chat_histogram(args.start_date, args.end_date)
print('Active chats today: ', len(chats))

msg_arr = []

numbers = [] 

for chat in chats:
    (source, chat_id, msgs) = chat
    msg_arr.append(msgs)

    if source == 'wa':
        numbers.append(f'{source}:{chat_id}')

    if msgs < 8:
        continue
    
    print(source, chat_id, msgs)

print(','.join(numbers))

print(numpy.histogram(msg_arr, [0, 5, 10, 15, 20, 50, 100]))

