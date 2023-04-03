wa_private_msg = {"source": "wa", "event": {"event_type": "message_received", "instanceId": "41580", "id": "", "referenceId": "", "data": {"id": "false_16692643480@c.us_D8F8C6B6BA3A3CDB7A", "from": "16692643480@c.us", "to": "420720604304@c.us", "author": "", "pushname": "Yoram Stern", "ack": "", "type": "chat", "body": "write an email - reminder to a colleague that I am waiting for his response to my last email message.", "media": "", "fromMe": false, "self": false, "isForwarded": false, "isMentioned": false, "quotedMsg": {}, "mentionedIds": [], "time": 1680509737}}}

wa_group_msg = {"source": "wa", "event": {"event_type": "message_received", "instanceId": "41580", "id": "", "referenceId": "", "data": {"id": "false_120363096187630544@g.us_75E1D9225FC9F80E423A74F4B0D3CB47_972526989206@c.us", "from": "120363096187630544@g.us", "to": "420720604304@c.us", "author": "972526989206@c.us", "pushname": "Yair", "ack": "", "type": "chat", "body": "\u05d4\u05d1\u05d0\u05ea\u05d9 \u05d0\u05ea \u05d0\u05d9\u05d2\u05d5\u05e8 \u05db\u05d3\u05d9 \u05e9\u05d0\u05d4\u05d9\u05d4 \u05d4\u05d1\u05d9\u05e0\u05d5\u05e0\u05d9 \u05d5\u05dc\u05d0 \u05d4\u05d2\u05e8\u05d5\u05e2.", "media": "", "fromMe": false, "self": false, "isForwarded": false, "isMentioned": false, "quotedMsg": {}, "mentionedIds": [], "time": 1680509267}}}

tg_private_msg = {"source": "tg", "event": {"update_id": 222379552, "message": {"message_id": 209, "from": {"id": 384674548, "is_bot": false, "first_name": "Yair", "language_code": "en"}, "chat": {"id": 384674548, "first_name": "Yair", "type": "private"}, "date": 1680532525, "text": "Yeah, we're back."}}}

tg_private_fwdd_msg = {"source": "tg", "event": {"update_id": 222379554, "message": {"message_id": 210, "from": {"id": 384674548, "is_bot": false, "first_name": "Yair", "language_code": "en"}, "chat": {"id": 384674548, "first_name": "Yair", "type": "private"}, "date": 1680532624, "forward_from": {"id": 384674548, "is_bot": false, "first_name": "Yair", "language_code": "en"}, "forward_date": 1680532618, "text": "\u05d4\u05dc\u05d5!!!"}}}

tg_group_msg = {"source": "tg", "event": {"update_id": 222379553, "message": {"message_id": 30878, "from": {"id": 384674548, "is_bot": false, "first_name": "Yair", "language_code": "en"}, "chat": {"id": -1001471194111, "title": "\u05e1\u05d9\u05d1\u05d5\u05d1 2", "type": "supergroup"}, "date": 1680532618, "text": "\u05d4\u05dc\u05d5!!!"}}}



msgs = {
    'wa_private_msg'      : wa_private_msg,
    'wa_group_msg'        : wa_group_msg,
    'tg_private_msg'      : tg_private_msg,
    'tg_private_fwdd_msg' : tg_private_fwdd_msg,
    'tg_group_msg'        : tg_group_msg
}
        
module.exports = {
    msgs,
};
