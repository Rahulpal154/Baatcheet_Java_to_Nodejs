'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Authors extends Model {
    static associate(models) {}
  }
  Authors.init({
    author_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    author_age: { type: DataTypes.SMALLINT },
    author_avatar: { type: DataTypes.STRING(255) },
    author_city_id: { type: DataTypes.INTEGER },
    author_city_name: { type: DataTypes.STRING(255) },
    author_country_id: { type: DataTypes.INTEGER },
    author_gender_id: { type: DataTypes.TINYINT, allowNull: false },
    author_gender_name: { type: DataTypes.STRING(255) },
    author_name: { type: DataTypes.STRING(255), allowNull: false },
    author_state_id: { type: DataTypes.INTEGER },
    author_email: { type: DataTypes.STRING(255) },
    location_id: { type: DataTypes.INTEGER },
    location_name: { type: DataTypes.STRING(255) },
    author_mobile: { type: DataTypes.BIGINT },
    users_id: { type: DataTypes.INTEGER },
    user_id: { type: DataTypes.INTEGER },
    author_type: { type: DataTypes.TINYINT, defaultValue: 0 },
    created_on: { type: DataTypes.DATE, defaultValue: '2023-11-01 00:00:00' },
    updated_on: { type: DataTypes.DATE, defaultValue: '2023-11-01 00:00:00' },
    author_name_hi: { type: DataTypes.STRING(255) },
    visitor_id: { type: DataTypes.INTEGER }
  }, {
    sequelize,
    modelName: 'authors',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return Authors;
};
