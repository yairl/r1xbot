"use strict";

module.exports = (sequelize, DataTypes) => {
  const user_settings = sequelize.define(
    "user_settings",
    {
      user_id: DataTypes.STRING,
      settings: DataTypes.JSONB,
      version: DataTypes.INTEGER
    },
    {}
  );
  return user_settings;
};
