#!/usr/bin/python3

import os
import sys
import json
import psycopg2
from dotenv import load_dotenv
from datetime import datetime

def connect_to_db():
    load_dotenv('.env.dev')
    connection_string = os.getenv('DB_CONNECTION_STRING')
    conn = psycopg2.connect(connection_string)
    return conn

def get_settings(user_id):
    conn = connect_to_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM user_settings WHERE user_id = %s", (user_id,))
    row = cursor.fetchone()

    if row:
        print("Settings for user_id {}: {}".format(user_id, row))
    else:
        print("No settings found for user_id {}".format(user_id))

    cursor.close()
    conn.close()

def set_setting(user_id, key_value_pairs):
    conn = connect_to_db()
    cursor = conn.cursor()

    cursor.execute("SELECT settings FROM user_settings WHERE user_id = %s", (user_id,))
    row = cursor.fetchone()

    settings = row[0] if row else {}

    for pair in key_value_pairs:
        key, value = pair.split("=")
        settings[key] = value

    cursor.execute("INSERT INTO user_settings (user_id, settings, version, created_at) VALUES (%s, %s, 1, %s)",
                   (user_id, json.dumps(settings), datetime.now()))

    conn.commit()
    cursor.close()
    conn.close()

def clear_setting(user_id, key):
    conn = connect_to_db()
    cursor = conn.cursor()

    cursor.execute("SELECT settings FROM user_settings WHERE user_id = %s", (user_id,))
    row = cursor.fetchone()

    if row:
        settings = row[0]
        if key in settings:
            del settings[key]
            cursor.execute("UPDATE user_settings SET settings = %s WHERE user_id = %s", (json.dumps(settings), user_id))
            conn.commit()
        else:
            print("Key not found in settings for user_id {}".format(user_id))
    else:
        print("No settings found for user_id {}".format(user_id))

    cursor.close()
    conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python script.py [get|set|clear] user_id [key=value [key=value]...]")
        sys.exit(1)

    action = sys.argv[1]
    user_id = sys.argv[2]

    if action == "get":
        get_settings(user_id)
    elif action == "set":
        if len(sys.argv) < 4:
            print("Usage: python script.py set user_id key=value [key=value]...")
            sys.exit(1)

        key_value_pairs = sys.argv[3:]
        set_setting(user_id, key_value_pairs)
    elif action == "clear":
        if len(sys.argv) < 4:
            print("Usage: python script.py clear user_id key")
            sys.exit(1)

        key = sys.argv[3]
        clear_setting(user_id, key)
    else:
        print("Invalid action. Use get, set, or clear.")
        sys.exit(1)

