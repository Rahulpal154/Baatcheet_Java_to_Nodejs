'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserTriggerMap extends Model {
    static associate(models) {}
  }
  UserTriggerMap.init({
    utrigger_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    trigger_id: { type: DataTypes.INTEGER },
    trigger_name: { type: DataTypes.STRING(255) },
    user_id: { type: DataTypes.INTEGER },
    visitor_id: { type: DataTypes.STRING(36) }
  }, {
    sequelize,
    modelName: 'user_trigger_map',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return UserTriggerMap;
};
