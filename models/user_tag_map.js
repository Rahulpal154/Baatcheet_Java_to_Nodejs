'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserTagMap extends Model {
    static associate(models) {}
  }
  UserTagMap.init({
    ut_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tag_id: { type: DataTypes.INTEGER },
    tag_name: { type: DataTypes.STRING(255) },
    user_id: { type: DataTypes.INTEGER }
  }, {
    sequelize,
    modelName: 'user_tag_map',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return UserTagMap;
};
