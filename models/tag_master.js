'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class TagMaster extends Model {
    static associate(models) {}
  }
  TagMaster.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    created_on: { type: DataTypes.DATE(6) },
    is_active: { type: DataTypes.BOOLEAN },
    tag_desc: { type: DataTypes.STRING(255), allowNull: false },
    updated_on: { type: DataTypes.DATE(6) },
    tag_desc_hi: { type: DataTypes.STRING(255) }
  }, {
    sequelize,
    modelName: 'tag_master',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return TagMaster;
};
