'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StoryDetails extends Model {
    static associate(models) {}
  }
  StoryDetails.init({
    story_details_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    audio_link: { type: DataTypes.STRING(255) },
    language: { type: DataTypes.TINYINT },
    regional_desc: { type: DataTypes.STRING(255) },
    regional_title: { type: DataTypes.STRING(255) },
    story_id: { type: DataTypes.INTEGER }
  }, {
    sequelize,
    modelName: 'story_details',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return StoryDetails;
};
