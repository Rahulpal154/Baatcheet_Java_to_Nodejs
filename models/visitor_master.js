'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class VisitorMaster extends Model {
    static associate(models) {}
  }
  VisitorMaster.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    preferred_language: { type: DataTypes.TINYINT },
    visitor_id: { type: DataTypes.STRING(255) }
  }, {
    sequelize,
    modelName: 'visitor_master',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return VisitorMaster;
};
