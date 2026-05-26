const model = require('../models/index');
const { validationResult} = require("express-validator");
const { generateToken } = require("../services/token");
const crypto = require("crypto")

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

module.exports = {
    handleValidationErrors,getToken,normalizeNullFields, generateUUID
};
