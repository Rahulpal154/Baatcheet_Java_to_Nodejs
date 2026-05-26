const { matchedData } = require("express-validator");
const model = require('../models/index');
const {handleValidationErrors} = require('../utils/helper')
const {getTableDetails} = require('../utils/dbQueries');
const {sendAPIError,sendSuccess, sendError} = require('../utils/responseStatus');
// const authService = require("../services/authService");

// function for user login with email-password
const userLogin = async (req, res) => {
    try{
        if (handleValidationErrors(req, res)) return;
        const {email,workflow,device_id,recaptcha_token} = matchedData(req);
        console.log(email,workflow,device_id,recaptcha_token);
        const message = "OTP sent to your email id "+email+". It will expire in 15 minutes.";
        return sendSuccess(res,message)
    }
    catch (error) {
        console.log(error);
        return sendError(res)
    }
}


exports.userLogin = userLogin;