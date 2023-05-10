#!/usr/bin/python3

import dotenv
import os
import psycopg2
import psycopg2.extras
import wx

START_DATE='2023/04/12'

dotenv.load_dotenv('.env.prod')
ps = psycopg2.connect(os.environ['DB_CONNECTION_STRING'])

cur = ps.cursor(cursor_factory=psycopg2.extras.DictCursor)
cur.execute('''SELECT * FROM "Messages" WHERE DATE("createdAt") > '%s' ORDER BY "createdAt" DESC;''' % START_DATE)
raw_msgs = cur.fetchall()

msgs = []
for raw_msg in raw_msgs:
    msgs.append(dict(zip([column[0] for column in cur.description], raw_msg)))

class ChatsFrame(wx.Frame):
    def __init__(self, *args, **kw):
        super(ChatsFrame, self).__init__(*args, **kw)

        # create a panel for the frame
        panel = wx.Panel(self)

        # create the chats control
        self.chats_list = wx.ListCtrl(panel, style=wx.LC_REPORT)

        chats_list = self.chats_list
        chats_list.InsertColumn(0, 'Chat name', width=200)
        chats_list.InsertColumn(1, 'Chat ID', width=200)

        chats_inserted = {}
        for msg in msgs:
            chat_id = msg['chatId']
            if msg['rawSource']['chat']['type'] == 'private':
                chat_title = msg['rawSource']['chat']['first_name']
            else:
                chat_title = msg['rawSource']['chat']['title']

            if chat_id in chats_inserted:
                continue

            insert_loc = len(chats_inserted)

            chats_list.InsertStringItem(insert_loc, chat_title)
            chats_list.SetStringItem(insert_loc, 1, chat_id)

            chats_inserted[chat_id] = True

        chats_list.Bind(wx.EVT_LIST_ITEM_ACTIVATED, self.on_chat_activated)

        # create the second list control
        self.msgs_list = wx.ListCtrl(panel, style=wx.LC_REPORT)

        msgs_list = self.msgs_list
        msgs_list.InsertColumn(0, 'Bot', width=400)
        msgs_list.InsertColumn(1, 'Others', width=400)

        # use a horizontal box sizer to layout the two lists side by side
        hbox = wx.BoxSizer(wx.HORIZONTAL)
        hbox.Add(chats_list, 1, wx.EXPAND | wx.ALL, 5)
        hbox.Add(msgs_list, 1, wx.EXPAND | wx.ALL, 5)
        panel.SetSizer(hbox)

        # set the size and display the frame
        self.SetSize((1200, 800))
        self.Centre()
        self.Show(True)

    def on_chat_activated(self, event):
        idx = event.GetIndex()
        chat_id = self.chats_list.GetItemText(event.GetIndex(), 1)

        self.msgs_list.DeleteAllItems()

        num_msgs = 0
        for msg in reversed(msgs):
            curr_chat_id = msg['chatId']
            if curr_chat_id != chat_id:
                continue

            self.msgs_list.InsertStringItem(num_msgs, '')
            col_idx = 0 if msg['isSentByMe'] else 1
            self.msgs_list.SetStringItem(num_msgs, col_idx, msg['body'])

            num_msgs += 1


if __name__ == '__main__':
    app = wx.App()
    frm = ChatsFrame(None, title='R1X viewer')
    app.MainLoop()

