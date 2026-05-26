'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StoryTagMap extends Model {
    static associate(models) {}
  }
  StoryTagMap.init({
    ut_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tag_id: { type: DataTypes.INTEGER },
    story_id: { type: DataTypes.INTEGER }
  }, {
    sequelize,
    modelName: 'story_tag_map',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return StoryTagMap;
};
