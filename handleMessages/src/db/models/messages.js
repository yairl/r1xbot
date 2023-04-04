"use strict";

module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define(
    "Message",
    {
      source: DataTypes.STRING,
      messageTimestamp: DataTypes.DATE,
      chatId: DataTypes.STRING,
      senderId: DataTypes.STRING,
      isSentByMe : DataTypes.BOOLEAN,
      messageId: DataTypes.STRING,
      replyToMessageId: DataTypes.STRING,
      kind: DataTypes.STRING,
      body: DataTypes.STRING,
      rawSource: DataTypes.JSON
    },
    {}
  );
  return Message;
};
