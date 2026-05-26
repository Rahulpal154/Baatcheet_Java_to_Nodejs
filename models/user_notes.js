'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserNotes extends Model {
    static associate(models) {}
  }
  UserNotes.init({
    note_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    created_on: { type: DataTypes.DATE(6) },
    draft_text: { type: DataTypes.STRING(5000) },
    media_link: { type: DataTypes.STRING(255) },
    updated_on: { type: DataTypes.DATE(6) },
    user_id: { type: DataTypes.INTEGER },
    draft_text_hi: { type: DataTypes.STRING(5000) },
    media_link_hi: { type: DataTypes.STRING(255) }
  }, {
    sequelize,
    modelName: 'user_notes',
    freezeTableName: true,
    timestamps: false,
    sync: false
  });
  return UserNotes;
};
