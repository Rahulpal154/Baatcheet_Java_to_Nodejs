'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AuthorCommunityMap extends Model {
    static associate(models) {}
  }
  AuthorCommunityMap.init({
    ac_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    community_id: { type: DataTypes.TINYINT },
    community_name: { type: DataTypes.STRING(255) },
    author_id: { type: DataTypes.INTEGER }
  }, {
    sequelize,
    modelName: 'author_community_map',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return AuthorCommunityMap;
};
