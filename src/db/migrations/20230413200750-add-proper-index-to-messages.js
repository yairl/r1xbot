"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex("Messages", ["createdAt", "chatId"], {
      name: "index_on_messages_created_at_chat_id"
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex(
      "Messages",
      "index_on_messages_created_at_chat_id"
    );
  }
};
