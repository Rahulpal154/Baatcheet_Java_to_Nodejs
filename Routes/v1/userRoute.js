'use strict';

const express = require('express');
const { body, param } = require('express-validator');
const { registerUser, loginUser, updateUserById } = require('../../Controllers/userController');
const auth = require('../../middleware/token');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management APIs
 */

// ─────────────────────────────────────────────────────────────────────────────
// POST /users/register  (#1258)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/register:
 *   post:
 *     summary: Register a new user
 *     description: >
 *       Creates a new user. Mirrors Java UserServiceImpl.saveUser().
 *       isEmailLogin=true → validates email uniqueness.
 *       isEmailLogin=false → validates mobile uniqueness.
 *       Returns UserResponseDto + JWT on success (201).
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userName, userAge, userGenderId, languageEnum, locationId, locationName, userEmail]
 *             properties:
 *               userName:      { type: string, example: "Priya Sharma" }
 *               userAge:       { type: integer, example: 25 }
 *               userMobile:    { type: integer, example: 9876543210 }
 *               userGenderId:  { type: integer, description: "0=OTHER,1=MALE,2=FEMALE,3=TRANSGENDER,4=NON_BINARY,5=PREFER_NOT_TO_SAY", example: 2 }
 *               languageEnum:  { type: integer, description: "0=ENGLISH,1=HINDI", example: 0 }
 *               locationId:    { type: integer, example: 101 }
 *               locationName:  { type: string, example: "Mumbai" }
 *               userEmail:     { type: string, format: email, example: "priya@example.com" }
 *               userAvatar:    { type: string, example: "avatar_001.png" }
 *               isEmailLogin:  { type: boolean, default: true }
 *               userTag:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     tagId: { type: integer, example: 3 }
 *               triggers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     triggerId: { type: integer, example: 2 }
 *               userCommunity:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     communityId: { type: integer, description: "0=OTHER,1=LGBTQIA,2=PERSON_WITH_DISABILITY,3=DALIT_BAHUJAN_OR_ADIVASI,4=RELIGIOUS_MINORITIES,5=NOT_APPLICABLE", example: 0 }
 *     responses:
 *       201:
 *         description: User registered successfully with JWT token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:       { type: integer, example: 42 }
 *                 userName:     { type: string, example: "Priya Sharma" }
 *                 userEmail:    { type: string, example: "priya@example.com" }
 *                 jwtToken:     { type: string, example: "eyJhbGciOiJIUzI1NiJ9..." }
 *                 isEmailLogin: { type: boolean, example: true }
 *       409:
 *         description: Duplicate email or mobile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "User already exists with email Id: priya@example.com" }
 *       422:
 *         $ref: '#/components/responses/422'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/register', [
  body('userName').notEmpty().withMessage('userName is required').isString(),
  body('userAge').notEmpty().withMessage('userAge is required').isInt({ min: 1, max: 120 }),
  body('userGenderId').notEmpty().withMessage('userGenderId is required').isInt({ min: 0, max: 5 }),
  body('languageEnum').notEmpty().withMessage('languageEnum is required').isInt({ min: 0, max: 1 }),
  body('locationId').notEmpty().withMessage('locationId is required').isInt(),
  body('locationName').notEmpty().withMessage('locationName is required').isString(),
  body('userEmail').notEmpty().withMessage('userEmail is required').isEmail(),
  body('userMobile').optional({ nullable: true }).isNumeric(),
  body('userAvatar').optional({ nullable: true }).isString(),
  body('isEmailLogin').optional({ nullable: true }).isBoolean(),
  body('userTag').optional().isArray(),
  body('userTag.*.tagId').optional().isInt(),
  body('triggers').optional().isArray(),
  body('triggers.*.triggerId').optional().isInt(),
  body('userCommunity').optional().isArray(),
  body('userCommunity.*.communityId').optional().isInt({ min: 0, max: 5 }),
], registerUser);

// ─────────────────────────────────────────────────────────────────────────────
// POST /users/login  (#1257)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/login:
 *   post:
 *     summary: User login
 *     description: >
 *       Checks if user exists by email OR mobile. Mirrors Java
 *       UserServiceImpl.checkExistingUser().
 *       Returns userExists=TRUE/FALSE (always HTTP 200).
 *       On success sets cookies: user_type=USER, jwt_token, login_timestamp.
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userEmail:  { type: string, format: email, example: "priya@example.com" }
 *               userMobile: { type: integer, example: 9876543210 }
 *           examples:
 *             email:  { summary: "Email login",  value: { userEmail: "priya@example.com" } }
 *             mobile: { summary: "Mobile login", value: { userMobile: 9876543210 } }
 *     responses:
 *       200:
 *         description: Login result (TRUE=found, FALSE=not found)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userExists:   { type: string, enum: [TRUE, FALSE], example: "TRUE" }
 *                 userId:       { type: integer, nullable: true, example: 42 }
 *                 jwtToken:     { type: string, nullable: true, example: "eyJhbGciOiJIUzI1NiJ9..." }
 *                 isEmailLogin: { type: boolean, nullable: true, example: true }
 *       422:
 *         $ref: '#/components/responses/422'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/login', [
  body('userEmail').optional({ nullable: true }).isEmail().withMessage('userEmail must be a valid email'),
  body('userMobile').optional({ nullable: true }).isNumeric().withMessage('userMobile must be numeric'),
  body().custom((value) => {
    if (!value.userEmail && !value.userMobile) throw new Error('Either userEmail or userMobile is required');
    return true;
  }),
], loginUser);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /users/:userId  (#1259)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/{userId}:
 *   put:
 *     summary: Update user profile
 *     description: >
 *       Updates an existing user's profile. Mirrors Java
 *       UserController.updateUser() → UserServiceImpl.updateUser().
 *
 *       Business rules (exact Java parity):
 *       - For email-login users (isEmailLogin=true): mobile can be updated; email stays fixed.
 *       - For mobile-login users (isEmailLogin=false): email can be updated; mobile stays fixed.
 *       - Communities, tags and triggers are REPLACED (delete-all + re-insert).
 *       - 409 returned if updated mobile/email already exists for another user.
 *       - 404 if userId not found.
 *       - Requires Authorization header (Bearer JWT).
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the user to update
 *         example: 42
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userName:      { type: string, example: "Priya Sharma Updated" }
 *               userAge:       { type: integer, example: 26 }
 *               userMobile:    { type: integer, example: 9876543210 }
 *               userGenderId:  { type: integer, description: "0=OTHER,1=MALE,2=FEMALE,3=TRANSGENDER,4=NON_BINARY,5=PREFER_NOT_TO_SAY", example: 2 }
 *               languageEnum:  { type: integer, description: "0=ENGLISH,1=HINDI", example: 1 }
 *               locationId:    { type: integer, example: 55 }
 *               locationName:  { type: string, example: "Delhi" }
 *               userEmail:     { type: string, format: email, example: "priya.new@example.com" }
 *               userAvatar:    { type: string, example: "avatar_002.png" }
 *               userTag:
 *                 type: array
 *                 description: Replaces all existing tags
 *                 items:
 *                   type: object
 *                   properties:
 *                     tagId: { type: integer, example: 5 }
 *               triggers:
 *                 type: array
 *                 description: Replaces all existing triggers
 *                 items:
 *                   type: object
 *                   properties:
 *                     triggerId: { type: integer, example: 3 }
 *               userCommunity:
 *                 type: array
 *                 description: Replaces all existing communities
 *                 items:
 *                   type: object
 *                   properties:
 *                     communityId: { type: integer, description: "0=OTHER,1=LGBTQIA,2=PERSON_WITH_DISABILITY,3=DALIT_BAHUJAN_OR_ADIVASI,4=RELIGIOUS_MINORITIES,5=NOT_APPLICABLE", example: 1 }
 *           examples:
 *             basic_update:
 *               summary: Update name and age
 *               value:
 *                 userName: "Priya Sharma Updated"
 *                 userAge: 26
 *                 userGenderId: 2
 *                 languageEnum: 1
 *                 locationId: 55
 *                 locationName: "Delhi"
 *             with_tags_and_triggers:
 *               summary: Update with tags and triggers replacement
 *               value:
 *                 userName: "Rahul Kumar"
 *                 userAge: 31
 *                 userGenderId: 1
 *                 languageEnum: 0
 *                 locationId: 101
 *                 locationName: "Mumbai"
 *                 userTag: [{ "tagId": 5 }]
 *                 triggers: [{ "triggerId": 3 }]
 *                 userCommunity: [{ "communityId": 1 }]
 *     responses:
 *       200:
 *         description: User updated successfully — returns updated UserEntity row
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user_id:           { type: integer, example: 42 }
 *                 user_name:         { type: string, example: "Priya Sharma Updated" }
 *                 user_age:          { type: integer, example: 26 }
 *                 user_mobile:       { type: integer, example: 9876543210 }
 *                 user_gender_id:    { type: string, example: "FEMALE" }
 *                 preferred_language:{ type: integer, example: 1 }
 *                 location_id:       { type: integer, example: 55 }
 *                 location_name:     { type: string, example: "Delhi" }
 *                 user_email:        { type: string, example: "priya@example.com" }
 *                 user_avatar:       { type: string, example: "avatar_002.png" }
 *                 is_email_login:    { type: boolean, example: true }
 *                 is_participant:    { type: boolean, example: false }
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "User not found with id: 42" }
 *       409:
 *         description: Duplicate email or mobile conflict
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "User already exists with mobile: 9876543210" }
 *       401:
 *         $ref: '#/components/responses/401'
 *       422:
 *         $ref: '#/components/responses/422'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.put('/:userId', auth, [
  param('userId').isInt({ min: 1 }).withMessage('userId must be a positive integer'),
  body('userName').optional().isString(),
  body('userAge').optional().isInt({ min: 1, max: 120 }).withMessage('userAge must be 1-120'),
  body('userGenderId').optional().isInt({ min: 0, max: 5 }).withMessage('userGenderId must be 0-5'),
  body('languageEnum').optional().isInt({ min: 0, max: 1 }).withMessage('languageEnum must be 0 or 1'),
  body('locationId').optional().isInt(),
  body('locationName').optional().isString(),
  body('userEmail').optional({ nullable: true }).isEmail().withMessage('Invalid email format'),
  body('userMobile').optional({ nullable: true }).isNumeric(),
  body('userAvatar').optional({ nullable: true }).isString(),
  body('userTag').optional().isArray(),
  body('userTag.*.tagId').optional().isInt(),
  body('triggers').optional().isArray(),
  body('triggers.*.triggerId').optional().isInt(),
  body('userCommunity').optional().isArray(),
  body('userCommunity.*.communityId').optional().isInt({ min: 0, max: 5 }),
], updateUserById);

module.exports = router;
