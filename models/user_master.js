'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserMaster extends Model {
    static associate(models) {}
  }
  UserMaster.init({
    user_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    is_email_login: { type: DataTypes.BOOLEAN, defaultValue: 1 },
    preferred_language: { type: DataTypes.TINYINT, allowNull: false },
    location_id: { type: DataTypes.INTEGER, allowNull: false },
    location_name: { type: DataTypes.STRING(255), allowNull: false },
    user_age: { type: DataTypes.SMALLINT, allowNull: false },
    user_email: { type: DataTypes.STRING(255), allowNull: false },
    user_gender_id: {
      type: DataTypes.ENUM('FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY', 'TRANSGENDER'),
      allowNull: false
    },
    user_mobile: { type: DataTypes.BIGINT, allowNull: false },
    user_name: { type: DataTypes.STRING(255), allowNull: false },
    is_participant: { type: DataTypes.BOOLEAN, defaultValue: 0 },
    created_on: { type: DataTypes.DATE, defaultValue: '2024-01-22 00:00:01' },
    updated_on: { type: DataTypes.DATE, defaultValue: '2024-01-22 00:00:01' },
    user_avatar: { type: DataTypes.STRING(255) }
  }, {
    sequelize,
    modelName: 'user_master',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return UserMaster;
};
