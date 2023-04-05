"use strict";
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Messages", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      source: {
        type: Sequelize.STRING
      },
      messageTimestamp: {
        type: Sequelize.DATE
      },
      chatType: {
        type: Sequelize.STRING
      },
      chatId: {
        type: Sequelize.STRING
      },
      senderId: {
        type: Sequelize.STRING
      },
      isSentByMe: {
        type: Sequelize.BOOLEAN
      },
      messageId: {
        type: Sequelize.STRING
      },
      replyToMessageId: {
        type: Sequelize.STRING
      },
      kind: {
        type: Sequelize.STRING
      },
      body: {
        type: Sequelize.TEXT
      },
      rawSource: {
        type: Sequelize.JSON
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
    await queryInterface.addIndex("Messages", ["chatId", "messageId"], {
      name: "index_on_messages_chat_id_message_id",
      unique: true
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex(
      "Messages",
      "index_on_messages_chat_id_message_id"
    );
    await queryInterface.dropTable("Messages");
  }
};
