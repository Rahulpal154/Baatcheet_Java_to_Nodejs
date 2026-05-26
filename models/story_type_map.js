'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StoryTypeMap extends Model {
    static associate(models) {}
  }
  StoryTypeMap.init({
    st_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    story_type: { type: DataTypes.TINYINT },
    story_id: { type: DataTypes.INTEGER }
  }, {
    sequelize,
    modelName: 'story_type_map',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return StoryTypeMap;
};
