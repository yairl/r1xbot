'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_settings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        allowNull: false,
        type: Sequelize.STRING
      },
      settings: {
        allowNull: false,
        type: Sequelize.JSONB
      },
      version: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes on user_id and created_at
    await queryInterface.addIndex('user_settings', ['user_id']);
    await queryInterface.addIndex('user_settings', ['created_at']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes on user_id and created_at
    await queryInterface.removeIndex('user_settings', ['user_id']);
    await queryInterface.removeIndex('user_settings', ['created_at']);

    // Drop the table
    await queryInterface.dropTable('user_settings');
  }
};
;
