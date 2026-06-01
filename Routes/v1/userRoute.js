'use strict';

const express = require('express');
const { body } = require('express-validator');
const { registerUser, loginUser } = require('../../Controllers/userController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management APIs
 */

// ─────────────────────────────────────────────────────────────────────────────
// POST /users/register  (Issue #1258)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/register:
 *   post:
 *     summary: Register a new user
 *     description: >
 *       Creates a new user account. Mirrors Java POST /users/register →
 *       UserServiceImpl.saveUser(). When isEmailLogin=true validates email
 *       uniqueness; when false validates mobile uniqueness.
 *       Returns UserResponseDto with JWT token on success (201).
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userName
 *               - userAge
 *               - userGenderId
 *               - languageEnum
 *               - locationId
 *               - locationName
 *               - userEmail
 *             properties:
 *               userName:
 *                 type: string
 *                 example: "Priya Sharma"
 *               userAge:
 *                 type: integer
 *                 example: 25
 *               userMobile:
 *                 type: integer
 *                 example: 9876543210
 *               userGenderId:
 *                 type: integer
 *                 description: "0=OTHER,1=MALE,2=FEMALE,3=TRANSGENDER,4=NON_BINARY,5=PREFER_NOT_TO_SAY"
 *                 example: 2
 *               languageEnum:
 *                 type: integer
 *                 description: "0=ENGLISH,1=HINDI"
 *                 example: 0
 *               locationId:
 *                 type: integer
 *                 example: 101
 *               locationName:
 *                 type: string
 *                 example: "Mumbai"
 *               userEmail:
 *                 type: string
 *                 format: email
 *                 example: "priya@example.com"
 *               userAvatar:
 *                 type: string
 *                 example: "avatar_001.png"
 *               isEmailLogin:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *               userTag:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     tagId:
 *                       type: integer
 *                       example: 3
 *               triggers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     triggerId:
 *                       type: integer
 *                       example: 2
 *               userCommunity:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     communityId:
 *                       type: integer
 *                       description: "0=OTHER,1=LGBTQIA,2=PERSON_WITH_DISABILITY,3=DALIT_BAHUJAN_OR_ADIVASI,4=RELIGIOUS_MINORITIES,5=NOT_APPLICABLE"
 *                       example: 0
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: integer
 *                   example: 42
 *                 userName:
 *                   type: string
 *                   example: "Priya Sharma"
 *                 userAge:
 *                   type: integer
 *                   example: 25
 *                 userMobile:
 *                   type: integer
 *                   example: 9876543210
 *                 userGenderId:
 *                   type: integer
 *                   example: 2
 *                 languageEnum:
 *                   type: integer
 *                   example: 0
 *                 locationId:
 *                   type: integer
 *                   example: 101
 *                 locationName:
 *                   type: string
 *                   example: "Mumbai"
 *                 userEmail:
 *                   type: string
 *                   example: "priya@example.com"
 *                 userAvatar:
 *                   type: string
 *                   example: "avatar_001.png"
 *                 jwtToken:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiJ9..."
 *                 isEmailLogin:
 *                   type: boolean
 *                   example: true
 *                 triggers:
 *                   type: array
 *                   items:
 *                     type: object
 *                 userTag:
 *                   type: array
 *                   items:
 *                     type: object
 *                 userCommunity:
 *                   type: array
 *                   items:
 *                     type: object
 *                 userSubmissions:
 *                   type: array
 *                   items:
 *                     type: object
 *       409:
 *         description: Duplicate email or mobile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User already exists with email Id: priya@example.com"
 *       404:
 *         description: Referenced tag or trigger not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Tag not found with id: 99"
 *       422:
 *         $ref: '#/components/responses/422'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post(
  '/register',
  [
    body('userName').notEmpty().withMessage('userName is required').isString(),
    body('userAge')
      .notEmpty().withMessage('userAge is required')
      .isInt({ min: 1, max: 120 }).withMessage('userAge must be a valid integer'),
    body('userGenderId')
      .notEmpty().withMessage('userGenderId is required')
      .isInt({ min: 0, max: 5 }).withMessage('userGenderId must be 0-5'),
    body('languageEnum')
      .notEmpty().withMessage('languageEnum is required')
      .isInt({ min: 0, max: 1 }).withMessage('languageEnum must be 0=ENGLISH or 1=HINDI'),
    body('locationId')
      .notEmpty().withMessage('locationId is required')
      .isInt().withMessage('locationId must be integer'),
    body('locationName').notEmpty().withMessage('locationName is required').isString(),
    body('userEmail')
      .notEmpty().withMessage('userEmail is required')
      .isEmail().withMessage('userEmail must be a valid email'),
    body('userMobile').optional({ nullable: true }).isNumeric().withMessage('userMobile must be numeric'),
    body('userAvatar').optional({ nullable: true }).isString(),
    body('isEmailLogin').optional({ nullable: true }).isBoolean(),
    body('userTag').optional().isArray(),
    body('userTag.*.tagId').optional().isInt().withMessage('tagId must be integer'),
    body('triggers').optional().isArray(),
    body('triggers.*.triggerId').optional().isInt().withMessage('triggerId must be integer'),
    body('userCommunity').optional().isArray(),
    body('userCommunity.*.communityId')
      .optional()
      .isInt({ min: 0, max: 5 })
      .withMessage('communityId must be 0-5'),
  ],
  registerUser
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /users/login  (Issue #1257)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/login:
 *   post:
 *     summary: User login
 *     description: >
 *       Checks if a user exists by email OR mobile. Mirrors Java
 *       UserController.checkExistingUser() → UserServiceImpl.checkExistingUser().
 *
 *       - If found: returns userExists="TRUE" with userId and JWT token.
 *         Sets cookies: user_type=USER, login_timestamp, jwt_token, avatar_file_path.
 *       - If not found: returns userExists="FALSE" with null fields (still HTTP 200).
 *
 *       Provide either userEmail (for email-login users) OR userMobile
 *       (for mobile-login users). At least one is required.
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userEmail:
 *                 type: string
 *                 format: email
 *                 example: "priya@example.com"
 *               userMobile:
 *                 type: integer
 *                 example: 9876543210
 *           examples:
 *             email_login:
 *               summary: Login with email
 *               value:
 *                 userEmail: "priya@example.com"
 *             mobile_login:
 *               summary: Login with mobile
 *               value:
 *                 userMobile: 9876543210
 *     responses:
 *       200:
 *         description: >
 *           Login result. userExists="TRUE" means user found and JWT issued.
 *           userExists="FALSE" means no user found (still 200, not 401).
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userExists:
 *                   type: string
 *                   enum: [TRUE, FALSE]
 *                   example: "TRUE"
 *                 userId:
 *                   type: integer
 *                   nullable: true
 *                   example: 42
 *                 jwtToken:
 *                   type: string
 *                   nullable: true
 *                   example: "eyJhbGciOiJIUzI1NiJ9..."
 *                 isEmailLogin:
 *                   type: boolean
 *                   nullable: true
 *                   example: true
 *             examples:
 *               found:
 *                 summary: User found
 *                 value:
 *                   userExists: "TRUE"
 *                   userId: 42
 *                   jwtToken: "eyJhbGciOiJIUzI1NiJ9..."
 *                   isEmailLogin: true
 *               not_found:
 *                 summary: User not found
 *                 value:
 *                   userExists: "FALSE"
 *                   userId: null
 *                   jwtToken: null
 *                   isEmailLogin: null
 *       422:
 *         $ref: '#/components/responses/422'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post(
  '/login',
  [
    body('userEmail')
      .optional({ nullable: true })
      .isEmail().withMessage('userEmail must be a valid email address'),
    body('userMobile')
      .optional({ nullable: true })
      .isNumeric().withMessage('userMobile must be numeric'),
    body().custom((value) => {
      if (!value.userEmail && !value.userMobile) {
        throw new Error('Either userEmail or userMobile is required');
      }
      return true;
    }),
  ],
  loginUser
);

module.exports = router;
