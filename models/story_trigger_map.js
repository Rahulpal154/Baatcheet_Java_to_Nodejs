'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StoryTriggerMap extends Model {
    static associate(models) {}
  }
  StoryTriggerMap.init({
    ut_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    trigger_id: { type: DataTypes.INTEGER },
    story_id: { type: DataTypes.INTEGER }
  }, {
    sequelize,
    modelName: 'story_trigger_map',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return StoryTriggerMap;
};
