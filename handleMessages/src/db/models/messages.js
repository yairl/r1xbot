"use strict";

module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define(
    "Message",
    {
      source: DataTypes.STRING,
      messageTimestamp: DataTypes.DATE,
      chatType: DataTypes.STRING,
      chatId: DataTypes.STRING,
      senderId: DataTypes.STRING,
      isSentByMe: DataTypes.BOOLEAN,
      messageId: DataTypes.STRING,
      replyToMessageId: DataTypes.STRING,
      kind: DataTypes.STRING,
      body: DataTypes.TEXT,
      rawSource: DataTypes.JSON
    },
    {}
  );
  return Message;
};
