"use strict";

module.exports = (sequelize, DataTypes) => {
  const Chat = sequelize.define(
    "Chat",
    {
      userId: DataTypes.INTEGER,
      source: DataTypes.STRING,
      messageTimestamp: DataTypes.DATE,
      chatId: DataTypes.STRING,
      senderId: DataTypes.STRING,
      messageId: DataTypes.STRING,
      kind: DataTypes.STRING,
      body: DataTypes.JSON
    },
    {}
  );
  return Chat;
};
