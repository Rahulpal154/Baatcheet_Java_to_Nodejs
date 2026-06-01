const express = require('express');
const router = express.Router();
const auth = require('../middleware/token');

router.use('/v1/auth', require('./v1/authenticationRoute'));
router.use('/v1/users', require('./v1/userRoute'));   // ← add this line

module.exports = router;