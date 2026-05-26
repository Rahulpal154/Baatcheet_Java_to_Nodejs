'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class QuestionMaster extends Model {
    static associate(models) {}
  }
  QuestionMaster.init({
    question_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    question_module: { type: DataTypes.TINYINT },
    question_text: { type: DataTypes.STRING(300) },
    question_type: { type: DataTypes.TINYINT },
    question_text_hi: { type: DataTypes.STRING(300) },
    placeholder_text_en: { type: DataTypes.STRING(1000) },
    placeholder_text_hi: { type: DataTypes.STRING(1000) }
  }, {
    sequelize,
    modelName: 'question_master',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return QuestionMaster;
};
