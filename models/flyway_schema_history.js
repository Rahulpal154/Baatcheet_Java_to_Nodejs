'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class FlywaySchemaHistory extends Model {
    static associate(models) {}
  }
  FlywaySchemaHistory.init({
    installed_rank: { type: DataTypes.INTEGER, primaryKey: true },
    version: { type: DataTypes.STRING(50) },
    description: { type: DataTypes.STRING(200), allowNull: false },
    type: { type: DataTypes.STRING(20), allowNull: false },
    script: { type: DataTypes.STRING(1000), allowNull: false },
    checksum: { type: DataTypes.INTEGER },
    installed_by: { type: DataTypes.STRING(100), allowNull: false },
    installed_on: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    execution_time: { type: DataTypes.INTEGER, allowNull: false },
    success: { type: DataTypes.BOOLEAN, allowNull: false }
  }, {
    sequelize,
    modelName: 'flyway_schema_history',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return FlywaySchemaHistory;
};
