const express = require('express');
let { userLogin} = require('../../Controllers/authController');
// let { validateUserEmail } = require('../../services/validation');
let { check } = require('express-validator');
const router = express.Router();


/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: login
 *     description: login
 *     tags:
 *       - Authentication
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: gajendra@thelattice.in
 *               workflow:
 *                 type: string
 *                 example: citizen
 *               recaptcha_token:
 *                 type: string
 *                 example: 6Lfadsfauiersr
 *               device_id:
 *                 type: string
 *                 example: device_001
 *     responses:
 *       200:
 *         description: successfull response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: number
 *                   example: 1
 *                 message:
 *                   type: string
 *                   example: OTP sent to your email id gajendra@thelattice.in. It will expire in 15 minutes.
 *       401:
 *         $ref: '#/components/responses/401'
 *       422:
 *         $ref: '#/components/responses/400'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post("/login",[
    check('email').isEmail({ ignore_max_length: true }).withMessage('Invalid email address'),
    check('workflow').isIn(['citizen','staff']).withMessage('Invalid workflow'),
    check('device_id').notEmpty().withMessage('Device id is required'),
    check('recaptcha_token').optional()
],userLogin)

module.exports = router;