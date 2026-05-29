'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TriggerMaster extends Model {
    static associate(models) {}
  }
  TriggerMaster.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    created_on: { type: DataTypes.DATE(6) },
    is_active: { type: DataTypes.BOOLEAN },
    trigger_desc: { type: DataTypes.STRING(255), allowNull: false },
    updated_on: { type: DataTypes.DATE(6) },
    trigger_desc_hi: { type: DataTypes.STRING(255) }
  }, {
    sequelize,
    modelName: 'trigger_master',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return TriggerMaster;
};
