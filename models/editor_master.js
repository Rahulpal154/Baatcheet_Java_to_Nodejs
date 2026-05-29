'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EditorMaster extends Model {
    static associate(models) {}
  }
  EditorMaster.init({
    editor_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    created_at: { type: DataTypes.DATE(6), allowNull: false },
    editor_email: { type: DataTypes.STRING(255), allowNull: false },
    editor_full_name: { type: DataTypes.STRING(255), allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false },
    is_admin: { type: DataTypes.BOOLEAN, allowNull: false }
  }, {
    sequelize,
    modelName: 'editor_master',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return EditorMaster;
};
