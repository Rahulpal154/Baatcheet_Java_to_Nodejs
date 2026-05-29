'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SubmissionFeedbackMediaLink extends Model {
    static associate(models) {}
  }
  SubmissionFeedbackMediaLink.init({
    submission_feedback_feedback_id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
    media_link: { type: DataTypes.STRING(255) }
  }, {
    sequelize,
    modelName: 'submission_feedback_media_link',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return SubmissionFeedbackMediaLink;
};
