'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserStoryInteraction extends Model {
    static associate(models) {}
  }
  UserStoryInteraction.init({
    user_story_interaction_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    story_id: { type: DataTypes.INTEGER },
    updated_on: { type: DataTypes.DATE, defaultValue: '2023-11-01 00:00:00' },
    user_id: { type: DataTypes.INTEGER },
    mark_as_read: { type: DataTypes.BOOLEAN, defaultValue: 0 },
    visitor_id: { type: DataTypes.STRING(36) }
  }, {
    sequelize,
    modelName: 'user_story_interaction',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return UserStoryInteraction;
};
