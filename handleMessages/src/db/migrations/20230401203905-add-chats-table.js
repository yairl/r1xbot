"use strict";
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("Chats", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER
      },
      source: {
        type: Sequelize.STRING
      },
      messageTimestamp: {
        type: Sequelize.DATE
      },
      chatId: {
        type: Sequelize.STRING
      },
      senderId: {
        type: Sequelize.STRING
      },
      messageId: {
        type: Sequelize.STRING
      },
      kind: {
        type: Sequelize.STRING
      },
      additionalData: {
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
    await queryInterface.addIndex("Chats", ["chatId", "messageId"], {
      name: "index_on_whatsapp_chats_chat_id_message_id"
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex(
      "Chats",
      "index_on_whatsapp_chats_chat_id_message_id"
    );
    await queryInterface.dropTable("Chats");
  }
};
