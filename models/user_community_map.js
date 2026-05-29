'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserCommunityMap extends Model {
    static associate(models) {}
  }
  UserCommunityMap.init({
    uc_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    community_id: { type: DataTypes.TINYINT },
    user_id: { type: DataTypes.INTEGER }
  }, {
    sequelize,
    modelName: 'user_community_map',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return UserCommunityMap;
};
