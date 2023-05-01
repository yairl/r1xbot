"use strict";

module.exports = (sequelize, DataTypes) => {
  const UserSettings = sequelize.define(
    "UserSettings",
    {
      user_id: DataTypes.STRING,
      settings: DataTypes.JSONB,
      version: DataTypes.INTEGER
    },
    {}
  );
  return UserSettings;
};
