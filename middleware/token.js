let router = require('express').Router();
let jwt = require('jsonwebtoken');
let { config } = require('../config/nodeConfig');
let secretKey = config().JWT_KEY;
const model = require('../models/index');

//middleware to verify the token
router.use(async function (req, res, next) {
    if (req.method === 'OPTIONS') {
        return next();
    }
    try {
        const token = req.headers.authorization?.split(' ')[1];
        console.log("check token: ", token)
        if (!token) {
            return res.status(403).send({ success: 0, message: 'No token provided' });
        }

        let decodedToken = await checkTokenValid(token);
        console.log("check decoded token: ", decodedToken)
        let auth = null;
        if(decodedToken.workflow =='citizen'){
            auth = await model.citizen_credentials.findOne({
                where:{
                    citizen_id:decodedToken.user_id
                },
                raw:true
            })

        }
        else{
            auth = await model.staff_credentials.findOne({
                where:{
                    staff_id: decodedToken.user_id
                },
                raw:true
            })

            if(auth && auth.is_verified && auth.is_active ==false){
                return res.status(401).json({
                    status: 0,
                    message: "Unauthorized"
                });
            }
        }
        const device_id = auth?.device_id;
            if(device_id != decodedToken.device_id){
                return res.status(401).json({
                    status: 0,
                    message: "Unauthorized"
                });
        }
        req.decodedToken = decodedToken;
        next();
    }
    catch (err) {
        console.log("Auth error:", err)
         if (err.name === "TokenExpiredError") {
        return res.status(401).json({
            status: 0,
            message: "Session expired"
        });
        }

        // other jwt errors
        return res.status(401).json({
            status: 0,
            message: "Invalid token"
        });
    }
});

const checkTokenValid = async(token) => {
        let decodedToken = jwt.verify(token, secretKey);
        return decodedToken;
}

module.exports = router;