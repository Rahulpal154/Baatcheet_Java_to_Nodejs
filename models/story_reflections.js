'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StoryReflections extends Model {
    static associate(models) {}
  }
  StoryReflections.init({
    reflection_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    answer_text: { type: DataTypes.STRING(5000) },
    media_link: { type: DataTypes.STRING(255) },
    reflection_count: { type: DataTypes.INTEGER },
    story_id: { type: DataTypes.INTEGER },
    updated_on: { type: DataTypes.DATE(6) },
    question_id: { type: DataTypes.INTEGER },
    user_id: { type: DataTypes.INTEGER }
  }, {
    sequelize,
    modelName: 'story_reflections',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return StoryReflections;
};
