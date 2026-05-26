const models = require('../models/index');
const {sequelize, Sequelize} = models
const getTableDetails = async (modelName, keys = {}, includes = [], order=[]) => {
    const query = {
        where: { ...keys },
        include: includes,
        raw: includes.length === 0
      };
      if (order.length > 0) {
        query.order = [order];
      }

    const tableDetails = await models[modelName].findOne(query);
    return tableDetails;
};

const createTableEntry = async (model_name,data)=>{
    const tableDetails = await models[model_name].create(data);

    return tableDetails;
}

const updateTableEntry = async (model_name,data,keys)=>{
    const tableDetails = await models[model_name].update(data,{
        where: {
            ...keys
        }
    });

    return tableDetails;
}

const deleteTableEntry = async (model_name, keys= {}) => {
    const result = await models[model_name].destroy({
        where: keys
    })
    return result;
}

const getTableList = async (modelName, keys = {}, attributes={},includes=[],order = []) => {
    const query = {
        where: { ...keys },
        include: includes,
        attributes,
        raw: includes.length === 0
      };
      if (order.length > 0) {
        query.order = [order];
      }

    const tableList = await models[modelName].findAll(query);
    return tableList;
};

const fetchRawQueryData= async (query) => {
    const result = await sequelize.query(
        query,
        { type: Sequelize.QueryTypes.SELECT }
      );

    return result;
}


module.exports = {
    getTableDetails,
    createTableEntry,
    updateTableEntry,
    getTableList,
    deleteTableEntry,
    fetchRawQueryData
};