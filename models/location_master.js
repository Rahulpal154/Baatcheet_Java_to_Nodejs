'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class LocationMaster extends Model {
    static associate(models) {}
  }
  LocationMaster.init({
    location_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    location: { type: DataTypes.STRING(255) },
    parent_id: { type: DataTypes.INTEGER },
    shortname: { type: DataTypes.STRING(255) },
    type: { type: DataTypes.TINYINT }
  }, {
    sequelize,
    modelName: 'location_master',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return LocationMaster;
};
