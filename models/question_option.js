'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class QuestionOption extends Model {
    static associate(models) {}
  }
  QuestionOption.init({
    option_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    option_text: { type: DataTypes.STRING(255) },
    question_id: { type: DataTypes.INTEGER },
    reflection_id: { type: DataTypes.INTEGER }
  }, {
    sequelize,
    modelName: 'question_option',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return QuestionOption;
};
