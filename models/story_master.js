'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StoryMaster extends Model {
    static associate(models) {}
  }
  StoryMaster.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    author_id: { type: DataTypes.INTEGER },
    author_name: { type: DataTypes.STRING(255), allowNull: false },
    created_on: { type: DataTypes.DATE(6) },
    featured_sequence: { type: DataTypes.INTEGER },
    first_published_on: { type: DataTypes.DATE(6) },
    is_published: { type: DataTypes.BOOLEAN },
    is_saved: { type: DataTypes.BOOLEAN },
    keywords: { type: DataTypes.STRING(255) },
    languages: { type: DataTypes.BLOB },
    original_language: { type: DataTypes.TINYINT },
    read_time: { type: DataTypes.INTEGER },
    speech_bubble_color: { type: DataTypes.STRING(255) },
    story_status: { type: DataTypes.TINYINT, allowNull: false },
    story_background_card_uri: { type: DataTypes.STRING(255) },
    story_desc: { type: DataTypes.STRING(255) },
    title: { type: DataTypes.STRING(255) },
    updated_on: { type: DataTypes.DATE(6) }
  }, {
    sequelize,
    modelName: 'story_master',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return StoryMaster;
};
