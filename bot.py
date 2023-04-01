import sys
import logging
import threading

from whatsapp_api_client_python import API as WAA

(wa_instance_id, wa_token) = eval(open('/home/yair/keys/greenapi.key').read()) 
wa_app = WAA.GreenApi(wa_instance_id, wa_token)

# openai settings
import openai
openai.api_key_path = '/home/yair/keys/openai.key'
openai_model = 'gpt-3.5-turbo'

# OpenAI functions
def generate_gpt_response(text_history):
    num_in_tokens = 0
    messages = []

    is_user = True
    for t in text_history:
        for l in t.split('\n'):
            num_in_tokens += len(l.split(' '))
            if num_in_tokens > 2048:
                return ('Your message or history are long, having more than 2048 words.', None)

        role = "user" if is_user else "assistant"
        messages.append({"role" : role, "content" : t})

        is_user = not is_user

    messages.append({"role" : "system", "content" : "You are a helpful expert assistant, Robot 1-X, integrated into a WhatsApp chat. More information about you is available at https://r1x.ai. When telling about yourself, prefer to provide the link as well."})

    messages.reverse()


    r = openai.ChatCompletion.create(
          model=openai_model,
          messages=messages
      )

    return (r.choices[0].message.content, r.usage.total_tokens)

# Bot functions
def wa_is_message_for_me(chat_id, text, body, is_quoted):
    # For group chats, only reply if directly talked to
    if chat_id.endswith('@c.us'):
        return (True, text)

    if is_quoted:
        if body['messageData']['quotedMessage']['participant'] != '420720604304@c.us':
            return (False, None)
        else:
            return (True, text)

    if not text.startswith('@420720604304'):
        return (False, None)

    text = text.removeprefix('@420720604304').strip()
    return (True, text)

def wa_extract_message_data(b):
    try:
        chat_id = b['senderData']['chatId']
        msg_id = b['idMessage']

        md = b['messageData']
        if 'extendedTextMessageData' in md:
            text = md['extendedTextMessageData']['text']
        else:
            text = md['textMessageData']['textMessage']

        is_quoted = 'quotedMessage' in md

        return (chat_id, msg_id, text, is_quoted)
    except:
        print('Error extracting message.')
        return (None, None, None, None)

def wa_unroll_message_history(chat_id, msg_id):
    cr = wa_app.journals.getChatHistory(chat_id, 20)
    fid = msg_id

    msg_history = []

    for i in range(len(cr.data)):
        crd = cr.data[i]

        if crd['idMessage'] != fid:
            continue

        if 'extendedTextMessage' in crd:
            text = crd['extendedTextMessage']['text']
        else:
            text = crd['textMessage']

        msg_history.append(text)

        if cr.data[i]['typeMessage'] == 'quotedMessage':
            fid = cr.data[i]['quotedMessage']['stanzaId']
        else:
            break

    print('Unrolled message history: ', msg_history)
    return msg_history

handled_messages_cache = {}

def wa_is_start_of_chat(chat_id):
    return len(wa_app.journals.getChatHistory(chat_id, 2).data) == 2

welcome_message = '''Hi, I'm Robot 1-X!
    Feel free to ask me for information about anything you'd like.
'''

def wa_handle_incoming_message(body):
    print(body)

    (chat_id, msg_id, text, is_quoted) = wa_extract_message_data(body)
    print('CID: %s, MID: %s, is_quoted: %s' % (chat_id, msg_id, is_quoted))

    if chat_id == None:
        return

    msg_key = (chat_id, msg_id)
    if msg_key in handled_messages_cache:
        return

    handled_messages_cache[msg_key] = True

    if wa_is_start_of_chat(chat_id):
        wa_app.sending.sendMessage(chat_id, welcome_message)


    (msg_for_me, text) = wa_is_message_for_me(chat_id, text, body, is_quoted)

    if text == None:
        return

    try:
        if is_quoted:
            text_history = wa_unroll_message_history(chat_id, msg_id)
        else:
            text_history = [text]

        (reply_text, total_tokens) = generate_gpt_response(text_history)
    except:
        return

    print(reply_text)
    print(total_tokens)

    #if total_tokens != None:
    #    wa_app.sending.sendMessage(chat_id, 'Model: %s, Total tokens: %d, Cost: %f$' % (openai_model, total_tokens, total_tokens * 0.002 / 1000))

    wa_app.sending.sendMessage(chat_id, reply_text, msg_id)


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

    if len(sys.argv) < 1:
        print("Usage: python bot.py")
        sys.exit(1)

    w_thread = threading.Thread(target=wa_run_polling, args=(wa_app,))
    w_thread.start()
    w_thread.join()

if __name__ == '__main__':
    logging.getLogger("requests").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    main()

