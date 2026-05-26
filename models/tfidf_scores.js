'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TfidfScores extends Model {
    static associate(models) {}
  }
  TfidfScores.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    field_type: { type: DataTypes.STRING(255) },
    score: { type: DataTypes.DOUBLE },
    story_id: { type: DataTypes.INTEGER },
    term: { type: DataTypes.STRING(255) }
  }, {
    sequelize,
    modelName: 'tfidf_scores',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return TfidfScores;
};
