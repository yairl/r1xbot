"use strict";

module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define(
    "Message",
    {
      userId: DataTypes.INTEGER,
      source: DataTypes.STRING,
      messageTimestamp: DataTypes.DATE,
      chatId: DataTypes.STRING,
      senderId: DataTypes.STRING,
      messageId: DataTypes.STRING,
      kind: DataTypes.STRING,
      body: DataTypes.STRING,
      rawSource: DataTypes.JSON
    },
    {}
  );
  return Message;
};
