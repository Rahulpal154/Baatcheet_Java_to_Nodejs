'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SectionMaster extends Model {
    static associate(models) {}
  }
  SectionMaster.init({
    section_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    section_content: { type: DataTypes.TEXT },
    section_order_no: { type: DataTypes.INTEGER },
    section_type: { type: DataTypes.TINYINT },
    story_details_id: { type: DataTypes.INTEGER }
  }, {
    sequelize,
    modelName: 'section_master',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return SectionMaster;
};
