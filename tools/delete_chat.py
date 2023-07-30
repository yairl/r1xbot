#!/usr/bin/python3

import os
import sys
import json
import psycopg2
from dotenv import load_dotenv
from datetime import datetime

def connect_to_db():
    stage = os.environ['R1X_STAGE'] if 'R1X_STAGE' in os.environ else 'dev'
    print('Connecting to %s environment...' % stage)
    load_dotenv('.env.%s' % stage)
    connection_string = os.getenv('DB_CONNECTION_STRING')
    conn = psycopg2.connect(connection_string)
    return conn

def delete_history(source, chat_id):
    conn = connect_to_db()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM \"Messages\" WHERE source = %s AND \"chatId\" = %s", (source, chat_id,)) 

    conn.commit()
    cursor.close()
    conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python script.py source chat_id")
        sys.exit(1)

    source = sys.argv[1]
    chat_id = sys.argv[2]

    delete_history(source, chat_id)

