'use strict';
const { Model } = require('sequelize');

// This is a database VIEW — read-only, no inserts/updates/deletes
module.exports = (sequelize, DataTypes) => {
  class StoryListView extends Model {
    static associate(models) {}
  }
  StoryListView.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, defaultValue: 0 },
    title: { type: DataTypes.STRING(255) },
    story_desc: { type: DataTypes.STRING(255) },
    speech_bubble_color: { type: DataTypes.STRING(255) },
    story_background_card_uri: { type: DataTypes.STRING(255) },
    tag_id: { type: DataTypes.INTEGER },
    trigger_id: { type: DataTypes.INTEGER },
    author_id: { type: DataTypes.INTEGER, allowNull: false },
    author_name: { type: DataTypes.STRING(255), allowNull: false },
    author_age: { type: DataTypes.SMALLINT },
    author_avatar: { type: DataTypes.STRING(255) },
    author_gender_id: { type: DataTypes.TINYINT, allowNull: false },
    author_gender_name: { type: DataTypes.STRING(255) },
    author_city_id: { type: DataTypes.INTEGER },
    author_city_name: { type: DataTypes.STRING(255) },
    author_state_id: { type: DataTypes.INTEGER },
    author_country_id: { type: DataTypes.INTEGER },
    community_ids: { type: DataTypes.TEXT },
    story_type: { type: DataTypes.TINYINT },
    read_time: { type: DataTypes.INTEGER },
    is_saved: { type: DataTypes.BOOLEAN },
    updated_on: { type: DataTypes.DATE(6) },
    reaction_type: { type: DataTypes.TEXT },
    story_status: { type: DataTypes.TINYINT, allowNull: false }
  }, {
    sequelize,
    modelName: 'story_list_view',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return StoryListView;
};
