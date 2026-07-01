const model = require('../models/index');
const { validationResult } = require("express-validator");
const { generateToken } = require("../services/token");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { config } = require("../config/nodeConfig");

const handleValidationErrors = (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        console.log(errors);
        res.status(422).json({
            status: 0,
            message: "Validation Error",
            error: errors.errors[0].msg
        });
        return true;
    }

    return false;
};

const getToken = (authRecord,workflow,device_id)=>{
    let user;
    if(workflow =='staff'){
        user = {
                user_id: authRecord.staff_id,
                role_id :authRecord.staff?.role_id,
                email: authRecord.email,
                device_id
        }
    }
    else{
         user = {
            user_id: authRecord.citizen_id,
            role_id :null,
            email: authRecord.email,
            device_id
        }
    }
    console.log("user check: ", user)
    const token  = generateToken(user,workflow);
    return token;
}

const normalizeNullFields = (data) => {
  Object.keys(data).forEach(key => {
    if (data[key] === undefined || data[key] === '') {
      data[key] = null;
    }
  });
  return data;
};

const generateUUID = () => crypto.randomUUID();

/**
 * Generate JWT token for an app user, matching Java JwtUtil.generateToken() claims exactly.
 * Claims: user_id, email_id, user_name, mobile_number, preferred_language, user_avatar
 *
 * Moved here from services/userService.js per review comment:
 * "This shouldn't be in userService file.. Add the token logic in utils/helper.js
 *  file or somewhere else.. and import it" — Gajendra-Rathore
 *
 * @param {Object} user - Sequelize user_master row (raw or model instance)
 * @returns {string} signed JWT
 */
const generateUserToken = (user) => {
  return jwt.sign(
    {
      user_id: user.user_id,
      email_id: user.user_email,
      user_name: user.user_name,
      mobile_number: user.user_mobile,
      preferred_language: user.preferred_language,
      user_avatar: user.user_avatar,
    },
    config().JWT_KEY,
    { expiresIn: '7d' }
  );
};

module.exports = {
    handleValidationErrors, getToken, normalizeNullFields, generateUUID, generateUserToken
};