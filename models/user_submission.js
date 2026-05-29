'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserSubmission extends Model {
    static associate(models) {}
  }
  UserSubmission.init({
    submission_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    created_on: { type: DataTypes.DATE(6) },
    draft_text: { type: DataTypes.STRING(5000) },
    draft_text_hi: { type: DataTypes.STRING(5000) },
    is_copied: { type: DataTypes.BOOLEAN },
    media_link: { type: DataTypes.TEXT },
    media_link_hi: { type: DataTypes.STRING(255) },
    story_status: { type: DataTypes.TINYINT },
    story_description: { type: DataTypes.TEXT },
    story_img: { type: DataTypes.STRING(255) },
    story_title: { type: DataTypes.STRING(255) },
    updated_on: { type: DataTypes.DATE(6) },
    author_id: { type: DataTypes.INTEGER },
    user_id: { type: DataTypes.INTEGER },
    visitor_id: { type: DataTypes.INTEGER },
    story_type: { type: DataTypes.TINYINT }
  }, {
    sequelize,
    modelName: 'user_submission',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return UserSubmission;
};
