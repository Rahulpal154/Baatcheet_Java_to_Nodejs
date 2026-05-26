'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserReactionMap extends Model {
    static associate(models) {}
  }
  UserReactionMap.init({
    reaction_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    reaction_type: { type: DataTypes.TINYINT },
    user_id: { type: DataTypes.INTEGER },
    section_id: { type: DataTypes.INTEGER }
  }, {
    sequelize,
    modelName: 'user_reaction_map',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return UserReactionMap;
};
