const jwt = require('jsonwebtoken');
let { config } = require('../config/nodeConfig');

const generateToken = (user, workflow) => {
    console.log("user in token service", user);
    return jwt.sign({ user_id: user.user_id, role_id: user?.role_id,device_id:user?.device_id, email: user?.email, workflow}, config().JWT_KEY, { expiresIn: '30d' });
}

const generateTempToken = (auth, workflow) => {
    return jwt.sign({ auth_id: auth.auth_id, email:auth?.email,device_id:auth?.device_id,temp: true,workflow }, config().JWT_TEMPKEY, { expiresIn: 1200 });
}

exports.generateToken = generateToken;
exports.generateTempToken = generateTempToken;