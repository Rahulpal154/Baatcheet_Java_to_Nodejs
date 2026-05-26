'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UsersFeedback extends Model {
    static associate(models) {}
  }
  UsersFeedback.init({
    feedback_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    comments: { type: DataTypes.STRING(5000) },
    created_at: { type: DataTypes.DATE(6), allowNull: false },
    feedback_section: { type: DataTypes.TINYINT },
    feedback_type: { type: DataTypes.TINYINT },
    user_id: { type: DataTypes.INTEGER }
  }, {
    sequelize,
    modelName: 'users_feedback',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return UsersFeedback;
};
