'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SubmissionPrompts extends Model {
    static associate(models) {}
  }
  SubmissionPrompts.init({
    sp_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    answer_text: { type: DataTypes.STRING(5000) },
    created_on: { type: DataTypes.DATE(6) },
    media_link: { type: DataTypes.STRING(255) },
    question_order: { type: DataTypes.INTEGER },
    question_text: { type: DataTypes.STRING(255) },
    updated_on: { type: DataTypes.DATE(6) },
    question_id: { type: DataTypes.INTEGER },
    submission_id: { type: DataTypes.INTEGER }
  }, {
    sequelize,
    modelName: 'submission_prompts',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return SubmissionPrompts;
};
