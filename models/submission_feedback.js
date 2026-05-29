'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SubmissionFeedback extends Model {
    static associate(models) {}
  }
  SubmissionFeedback.init({
    feedback_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    answer_text: { type: DataTypes.STRING(5000) },
    created_on: { type: DataTypes.DATE, defaultValue: '2023-11-01 00:00:00' },
    question_id: { type: DataTypes.INTEGER },
    submission_id: { type: DataTypes.INTEGER },
    media_link: { type: DataTypes.STRING(255) },
    updated_on: { type: DataTypes.DATE, defaultValue: '2023-11-01 00:00:00' }
  }, {
    sequelize,
    modelName: 'submission_feedback',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return SubmissionFeedback;
};
