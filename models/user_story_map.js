'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserStoryMap extends Model {
    static associate(models) {}
  }
  UserStoryMap.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    story_id: { type: DataTypes.INTEGER },
    user_id: { type: DataTypes.INTEGER }
  }, {
    sequelize,
    modelName: 'user_story_map',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return UserStoryMap;
};
