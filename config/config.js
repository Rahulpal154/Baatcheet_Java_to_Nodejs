require('dotenv').config();

module.exports = {
  "local": {
    "username": process.env.USER_NAME_L,
    "password": process.env.DB_PASSWORD_L,
    "database": process.env.DB_NAME_L,
    "host": process.env.DB_HOST_L,
    "dialect": process.env.DB_DIALECT_L,
    logging: false,
    port: process.env.DB_PORT_L,
    pool: {
      max: 1,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
  },
  "development": {
    "username": process.env.USER_NAME_D,
    "password": process.env.DB_PASSWORD_D,
    "database": process.env.DB_NAME_D,
    "host": process.env.DB_HOST_D,
    "dialect": process.env.DB_DIALECT_D,
    logging: false,
    port: process.env.DB_PORT_D,
    dialectOptions: {
      ssl: {
        require: true, // This will help you. But you will see nwe error
        rejectUnauthorized: false // This line will fix new error
      }
    },
    pool: {
      max: 20,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  "test": {
    "username": process.env.USER_NAME_T,
    "password": process.env.DB_PASSWORD_T,
    "database": process.env.DB_NAME_T,
    "host": process.env.DB_HOST_T,
    "dialect": process.env.DB_DIALECT_T,
    port: process.env.DB_PORT_T,
    logging: false,
    // For Testing Purpose
    // dialectOptions: {
    //   ssl: {
    //     require: true, // This will help you. But you will see nwe error
    //     rejectUnauthorized: false // This line will fix new error
    //   }
    // },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  },
  "production": {
    "username": process.env.USER_NAME_P,
    "password": process.env.DB_PASSWORD_P,
    "database": process.env.DB_NAME_P,
    "host": process.env.DB_HOST_P,
    "dialect": process.env.DB_DIALECT_P,
    port: process.env.DB_PORT_P,
    logging: false,
    dialectOptions: {
      ssl: {
        require: true, // This will help you. But you will see nwe error
        rejectUnauthorized: false // This line will fix new error
      }
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
}