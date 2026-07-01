'use strict';

/**
 * Routes/v1/userRoute.js
 *
 * Changes for #1263, #1264, #1266:
 *
 * ❌ REMOVED (WRONG routes):
 *   GET    /users/:userId/stories/:storyId          (#1263 wrong method + URL)
 *   POST   /users/:userId/stories/:storyId/bookmark (#1264 wrong URL)
 *   DELETE /users/:userId/stories/:storyId/bookmark (#1266 wrong URL)
 *
 * ✅ ADDED (CORRECT routes matching Java Swagger):
 *   POST   /users/mark-as-read/:storyId             (#1263)
 *   POST   /users/bookmark/:storyId                 (#1264)
 *   DELETE /users/bookmark/:userId/:storyId         (#1266)
 *
 * ⚠️  ROUTE ORDER NOTE:
 *   Static paths MUST be registered before parameterised paths to prevent
 *   Express shadowing.  Correct order:
 *     /register, /login, /search, /metrics, /mark-as-read/:storyId,
 *     /bookmark/:storyId, /bookmark/:userId/:storyId
 *     THEN /:userId and its sub-routes.
 */

const express = require('express');
const { body, param } = require('express-validator');
const {
  registerUser,
  loginUser,
  updateUserById,
  getUserById,
  deleteUserById,
  updateLanguageById,
  markStoryAsReadHandler,        // #1263
  addBookmark,                   // #1264
  getUserListHandler,
  deleteBookmark,                // #1266
  addSubmission,
  getSubmission,
  getSubmissions,
  deleteSubmission,
  getUserSearchHandler,
  getUserMetricsHandler,
  getUserMetricsByIdHandler,
  resetInteractionHandler,
  clearReflectionAndNotesHandler,
} = require('../../Controllers/userController');
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
 *     description: Creates a new user. Mirrors Java UserServiceImpl.saveUser().
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userName, userAge, userGenderId, languageEnum, locationId, locationName, userEmail]
 *             properties:
 *               userName:      { type: string,  example: "Priya Sharma" }
 *               userAge:       { type: integer, example: 25 }
 *               userMobile:    { type: integer, example: 9876543210 }
 *               userGenderId:  { type: integer, example: 2 }
 *               languageEnum:  { type: integer, example: 0 }
 *               locationId:    { type: integer, example: 101 }
 *               locationName:  { type: string,  example: "Mumbai" }
 *               userEmail:     { type: string,  format: email, example: "priya@example.com" }
 *               userAvatar:    { type: string,  example: "avatar_001.png" }
 *               isEmailLogin:  { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: User registered successfully
 *       409:
 *         description: Duplicate email or mobile
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
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userEmail:  { type: string, format: email }
 *               userMobile: { type: integer }
 *     responses:
 *       200:
 *         description: Login result (userExists TRUE/FALSE)
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
// GET /users  (#1265)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get paginated list of all users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User list retrieved
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Invalid pagination parameters
 */
router.get('/', auth, getUserListHandler);

// ─────────────────────────────────────────────────────────────────────────────
// GET /users/search  (#1268)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/search:
 *   get:
 *     summary: Search users by name or email
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: query
 *         schema: { type: string }
 *         example: "priya"
 *       - in: query
 *         name: pageIndex
 *         schema: { type: integer, minimum: 0, default: 0 }
 *       - in: query
 *         name: visitorId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Search results
 *       422:
 *         description: Invalid pageIndex
 */
router.get('/search', getUserSearchHandler);

// ─────────────────────────────────────────────────────────────────────────────
// GET /users/metrics  (#1269)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/metrics:
 *   get:
 *     summary: Get authenticated user's account metrics
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User account metrics
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
router.get('/metrics', auth, getUserMetricsHandler);

// ─────────────────────────────────────────────────────────────────────────────
// POST /users/mark-as-read/:storyId  (#1263)
//
// ✅ CORRECTED — previously was: GET /users/:userId/stories/:storyId
//
// Java Swagger: POST /users/mark-as-read/{storyId}?visitorId=
//   - Method:    POST  (was: GET — WRONG)
//   - Path:      /users/mark-as-read/:storyId  (was: /users/:userId/stories/:storyId — WRONG)
//   - Auth:      optional  (was: required — WRONG)
//   - storyId:   path param  ✅
//   - visitorId: query param  (was: missing — WRONG)
//   - userId:    NOT in path — derived from JWT token if present
//   - Validation:  param('storyId') only  (was: param('userId') + param('storyId') — WRONG)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/mark-as-read/{storyId}:
 *   post:
 *     summary: Mark a story as read by the current user
 *     description: >
 *       Marks the specified story as read for the authenticated user or visitor.
 *       Mirrors Java `UserController.markStoryAsReadByUser()`.
 *
 *       Business rules:
 *       - `storyId` is a **path parameter** (required).
 *       - `visitorId` is an **optional query parameter** for anonymous users.
 *       - **Authorization is optional** — logged-in users send a Bearer JWT;
 *         anonymous users pass visitorId query param.
 *       - If a user_story_interaction record already exists, it is updated
 *         (mark_as_read = 1); otherwise a new record is created.
 *       - **Response is void** — HTTP 200 with no body (Java returns void).
 *       - `userId` is NOT in the URL path — it is extracted from the JWT token.
 *     tags: [Users]
 *     security:
 *       - {}
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID of the story to mark as read
 *         example: 100
 *       - in: query
 *         name: visitorId
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional visitor UUID for anonymous users
 *         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Story marked as read successfully (no response body)
 *       404:
 *         description: Story not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "Story not found with id: 100" }
 *       422:
 *         description: Validation error — invalid storyId
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:  { type: integer, example: 0 }
 *                 message: { type: string,  example: "Validation Error" }
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/mark-as-read/:storyId', [
  // ✅ Only storyId validated — userId removed from path
  param('storyId').isInt({ min: 1 }).withMessage('storyId must be a positive integer'),
], markStoryAsReadHandler);

// ─────────────────────────────────────────────────────────────────────────────
// POST /users/bookmark/:storyId  (#1264)
//
// ✅ CORRECTED — previously was: POST /users/:userId/stories/:storyId/bookmark
//
// Java Swagger: POST /users/bookmark/{storyId}
//   - Path:     /users/bookmark/:storyId  (was: /users/:userId/stories/:storyId/bookmark)
//   - Auth:     required  ✅
//   - storyId:  path param  ✅
//   - userId:   NOT in path — derived from JWT token (req.decodedToken.user_id)
//   - Validation: param('storyId') only  (was: param('userId') + param('storyId'))
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/bookmark/{storyId}:
 *   post:
 *     summary: Add/save story to bookmarks
 *     description: >
 *       Bookmarks a story for the authenticated user.
 *       Mirrors Java `UserController.addBookmark()`.
 *
 *       Business rules:
 *       - `storyId` is a **path parameter**.
 *       - **userId is derived from the Bearer JWT token** — it is NOT in the URL path.
 *       - Returns HTTP 201 with bookmark details on success.
 *       - Returns HTTP 409 if the story is already bookmarked by this user.
 *       - Returns HTTP 404 if the story or user is not found.
 *       - **Authorization is required**.
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID of the story to bookmark
 *         example: 100
 *     responses:
 *       201:
 *         description: Story bookmarked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:      { type: boolean, example: true }
 *                 bookmarkId:   { type: integer, example: 1 }
 *                 userId:       { type: integer, example: 42 }
 *                 storyId:      { type: integer, example: 100 }
 *                 bookmarkedOn: { type: string,  format: date-time }
 *                 message:      { type: string,  example: "Story bookmarked successfully" }
 *       404:
 *         description: User or story not found
 *       409:
 *         description: Story already bookmarked by this user
 *       401:
 *         description: Unauthorized — no or invalid token
 *       403:
 *         $ref: '#/components/responses/403'
 *       422:
 *         description: Validation error
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/bookmark/:storyId', auth, [
  // ✅ Only storyId validated — userId removed from path
  param('storyId').isInt({ min: 1 }).withMessage('storyId must be a positive integer'),
], addBookmark);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /users/bookmark/:userId/:storyId  (#1266)
//
// ✅ CORRECTED — previously was: DELETE /users/:userId/stories/:storyId/bookmark
//
// Java Swagger: DELETE /users/bookmark/{userId}/{storyId}
//   - Path:     /users/bookmark/:userId/:storyId  (was: /users/:userId/stories/:storyId/bookmark)
//   - userId:   still a path param  ✅
//   - storyId:  still a path param  ✅
//   - Validation: UNCHANGED (both params still validated as positive integers)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/bookmark/{userId}/{storyId}:
 *   delete:
 *     summary: Remove/delete story from bookmarks
 *     description: >
 *       Removes a bookmarked story for the specified user.
 *       Mirrors Java `UserController.deleteBookmark()`.
 *
 *       Business rules:
 *       - Both `userId` and `storyId` are **path parameters**.
 *       - Returns HTTP 200 with a success map on deletion.
 *       - Returns HTTP 404 if the user, story, or bookmark is not found.
 *     tags: [Bookmarks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID of the user whose bookmark to remove
 *         example: 42
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID of the story to unbookmark
 *         example: 100
 *     responses:
 *       200:
 *         description: Bookmark removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:  { type: boolean, example: true }
 *                 userId:   { type: integer, example: 42 }
 *                 storyId:  { type: integer, example: 100 }
 *                 message:  { type: string,  example: "Story bookmark removed successfully" }
 *       404:
 *         description: User, story, or bookmark not found
 *       422:
 *         description: Validation error
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.delete('/bookmark/:userId/:storyId', auth, [
  param('userId').isInt({ min: 1 }).withMessage('userId must be a positive integer'),
  param('storyId').isInt({ min: 1 }).withMessage('storyId must be a positive integer'),
], deleteBookmark);

// ─────────────────────────────────────────────────────────────────────────────
// PUT /users/:userId  (#1259)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/{userId}:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         example: 42
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userName:      { type: string }
 *               userAge:       { type: integer }
 *               userMobile:    { type: integer }
 *               userGenderId:  { type: integer }
 *               languageEnum:  { type: integer }
 *               locationId:    { type: integer }
 *               locationName:  { type: string }
 *               userEmail:     { type: string, format: email }
 *               userAvatar:    { type: string }
 *     responses:
 *       200:
 *         description: User updated
 *       404:
 *         description: User not found
 *       409:
 *         description: Conflict
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /users/:userId  (#1260)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/{userId}:
 *   get:
 *     summary: Get user profile by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         example: 42
 *     responses:
 *       200:
 *         description: User profile retrieved
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
router.get('/:userId', auth, [
  param('userId').isInt({ min: 1 }).withMessage('userId must be a positive integer'),
], getUserById);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /users/:userId  (#1261)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/{userId}:
 *   delete:
 *     summary: Delete user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         example: 42
 *     responses:
 *       200:
 *         description: User deleted
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.delete('/:userId', auth, [
  param('userId').isInt({ min: 1 }).withMessage('userId must be a positive integer'),
], deleteUserById);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /users/language  (Swagger corrected)
//
// ✅ CORRECTED — was: PATCH /users/:userId/language
//
// Java Swagger: PATCH /users/language
//   - NO userId in path
//   - userId derived from JWT token (req.decodedToken.user_id)
//   - languageEnum in request body
//   - Auth: required
//   - Validation: ONLY languageEnum body — param('userId') REMOVED
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/language:
 *   patch:
 *     summary: Update the authenticated user's preferred language
 *     description: >
 *       Updates the language preference for the currently authenticated user.
 *       Mirrors Java `UserController.updateLanguage()`.
 *
 *       Business rules:
 *       - userId is derived from the Bearer JWT token — NOT from the URL path.
 *       - languageEnum must be 0 (ENGLISH) or 1 (HINDI).
 *       - Authorization is **required**.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [languageEnum]
 *             properties:
 *               languageEnum:
 *                 type: integer
 *                 enum: [0, 1]
 *                 description: "0 = ENGLISH, 1 = HINDI"
 *                 example: 1
 *     responses:
 *       200:
 *         description: Language updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:       { type: integer, example: 42 }
 *                 userName:     { type: string,  example: "Priya Sharma" }
 *                 languageEnum: { type: integer, example: 1 }
 *                 message:      { type: string,  example: "Language updated to HINDI" }
 *       401:
 *         description: Unauthorized — no or invalid token
 *       404:
 *         description: User not found
 *       422:
 *         description: Validation error — invalid languageEnum
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.patch('/language', auth, [
  // ✅ NO param('userId') — userId comes from token, not path
  body('languageEnum').isIn([0, 1]).withMessage('languageEnum must be 0 (ENGLISH) or 1 (HINDI)'),
], updateLanguageById);

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1267 — User Submissions (Add, Get, Delete)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// GET /users/submission/:submissionId  (Swagger corrected)
//
// ✅ CORRECTED — was: GET /users/:userId/submissions/:submissionId
//
// Java Swagger: GET /users/submission/{submissionId}
//   - submissionId: path param (singular "submission", NOT "submissions")
//   - userId: NOT in path — optional, from JWT token if auth provided
//   - Auth: optional (Java: "optional Authorization; request context")
//   - Validation: ONLY param('submissionId') — param('userId') REMOVED
//
// NOTE: Must be registered BEFORE /:userId to avoid Express shadowing.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/submission/{submissionId}:
 *   get:
 *     summary: Get a specific submission by ID
 *     description: >
 *       Retrieves a submission by its ID.
 *       Mirrors Java `UserController.getSubmission()`.
 *
 *       Business rules:
 *       - `submissionId` is the only path parameter.
 *       - `userId` is NOT in the URL — derived from JWT token if auth is provided.
 *       - **Authorization is optional** — if a token is present and valid, the
 *         submission is filtered by both submissionId AND userId (ownership check).
 *         If no token, the submission is fetched by submissionId only.
 *     tags: [Submissions]
 *     security:
 *       - {}
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID of the submission to retrieve
 *         example: 1
 *     responses:
 *       200:
 *         description: Submission retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 submissionId:      { type: integer, example: 1 }
 *                 userId:            { type: integer, example: 42 }
 *                 submissionTitle:   { type: string,  example: "My Story" }
 *                 submissionContent: { type: string,  example: "Story content here" }
 *                 submissionStatus:  { type: string,  example: "pending" }
 *                 createdOn:         { type: string,  format: date-time }
 *                 updatedOn:         { type: string,  format: date-time }
 *       404:
 *         description: Submission not found
 *       422:
 *         description: Validation error — invalid submissionId
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/submission/:submissionId', [
  // ✅ Only submissionId validated — no param('userId')
  param('submissionId').isInt({ min: 1 }).withMessage('submissionId must be a positive integer'),
], getSubmission);

// ─────────────────────────────────────────────────────────────────────────────
// User Submissions (#1267) — these remain on /:userId paths as implemented
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /users/{userId}/submissions:
 *   post:
 *     summary: Create a new user submission
 *     description: Add a new submission for a user
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 42
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - submissionTitle
 *               - submissionContent
 *             properties:
 *               submissionTitle: { type: string, example: "My Submission" }
 *               submissionContent: { type: string, example: "Submission content here" }
 *               submissionStatus: { type: string, enum: ["pending", "approved", "rejected"], default: "pending" }
 *     responses:
 *       201:
 *         description: Submission created successfully
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
router.post('/:userId/submissions', auth, [
  param('userId').isInt({ min: 1 }).withMessage('userId must be a positive integer'),
  body('submissionTitle').trim().notEmpty().withMessage('submissionTitle is required'),
  body('submissionContent').trim().notEmpty().withMessage('submissionContent is required'),
  body('submissionStatus').optional().isIn(['pending', 'approved', 'rejected']),
], addSubmission);

/**
 * @swagger
 * /users/{userId}/submissions:
 *   get:
 *     summary: Get all submissions for a user
 *     description: Retrieve paginated list of user submissions
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 42
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Submissions list retrieved
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Invalid pagination parameters
 */
router.get('/:userId/submissions', auth, getSubmissions);

/**
 * @swagger
 * /users/{userId}/submissions/{submissionId}:
 *   delete:
 *     summary: Delete a submission
 *     description: Remove a user submission
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 42
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Submission deleted
 *       404:
 *         description: User or submission not found
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 */
router.delete('/:userId/submissions/:submissionId', auth, [
  param('userId').isInt({ min: 1 }).withMessage('userId must be a positive integer'),
  param('submissionId').isInt({ min: 1 }).withMessage('submissionId must be a positive integer'),
], deleteSubmission);

// ─────────────────────────────────────────────────────────────────────────────
// GET /users/:userId/metrics  (#1269 compatibility)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /users/{userId}/metrics:
 *   get:
 *     summary: Get user account metrics by userId (compatibility route)
 *     description: >
 *       Compatibility route for older frontend clients that pass userId in the path.
 *       Per migration plan, old frontend routes are preserved alongside the canonical
 *       token-based route (`GET /users/metrics`).
 *       Authorization is required.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the user to retrieve metrics for
 *         example: 42
 *     responses:
 *       200:
 *         description: User account metrics retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserMetrics'
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       422:
 *         description: Validation error
 *       500:
 *         $ref: '#/components/responses/500'
 */

router.get('/:userId/metrics', auth, [
  param('userId').isInt({ min: 1 }).withMessage('userId must be a positive integer'),
], getUserMetricsByIdHandler);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /users/resetInteraction/:userId  (#1270)
// ─────────────────────────────────────────────────────────────────────────────
 
/**
 * @swagger
 * /users/resetInteraction/{userId}:
 *   delete:
 *     summary: Reset all story interactions for a user
 *     description: >
 *       Deletes all story interaction records and reaction records for the
 *       specified user. Mirrors Java `UserController.resetInteraction()` →
 *       `UserServiceImpl.resetInteraction()`.
 *
 *       Business rules:
 *       - Clears `user_story_interaction` (read history, mark-as-read flags).
 *       - Clears `user_reaction_map` (all section reactions by the user).
 *       - Both deletions occur in a single database transaction.
 *       - Returns `HTTP 200` with a message map on success.
 *       - Returns `HTTP 404` if userId does not exist.
 *       - Authorization is **required**.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID of the user whose interactions to reset
 *         example: 42
 *     responses:
 *       200:
 *         description: User interactions reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User interactions reset successfully"
 *                 userId:
 *                   type: integer
 *                   example: 42
 *                 deletedCounts:
 *                   type: object
 *                   properties:
 *                     storyInteractions: { type: integer, example: 12 }
 *                     reactions:         { type: integer, example: 5 }
 *             example:
 *               message: "User interactions reset successfully"
 *               userId: 42
 *               deletedCounts:
 *                 storyInteractions: 12
 *                 reactions: 5
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "User not found with id: 42" }
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       422:
 *         description: Validation error — invalid userId
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:  { type: integer, example: 0 }
 *                 message: { type: string,  example: "Validation Error" }
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.delete('/resetInteraction/:userId', auth, [
  param('userId').isInt({ min: 1 }).withMessage('userId must be a positive integer'),
], resetInteractionHandler);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /users/clearReflectionAndNotes/:userId  (#1270)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /users/clearReflectionAndNotes/{userId}:
 *   delete:
 *     summary: Clear all reflections and notes for a user
 *     description: >
 *       Deletes all reflection and note records for the specified user in a
 *       FK-safe transactional order. Mirrors Java
 *       `UserController.clearReflectionAndNotes()` →
 *       `UserServiceImpl.clearReflectionAndNotes()`.
 *
 *       Business rules and deletion order (FK constraints enforced):
 *       1. `note_prompts` deleted first — FK child of `user_notes`.
 *       2. `user_notes` deleted next — FK parent.
 *       3. `story_reflections` deleted — independent FK on `user_id`.
 *       - All three deletions occur in a single database transaction.
 *       - Returns `HTTP 200` with a message map on success.
 *       - Returns `HTTP 404` if userId does not exist.
 *       - Authorization is **required**.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: ID of the user whose reflections and notes to clear
 *         example: 42
 *     responses:
 *       200:
 *         description: Reflections and notes cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User reflections and notes cleared successfully"
 *                 userId:
 *                   type: integer
 *                   example: 42
 *                 deletedCounts:
 *                   type: object
 *                   properties:
 *                     notePrompts:      { type: integer, example: 8 }
 *                     userNotes:        { type: integer, example: 3 }
 *                     storyReflections: { type: integer, example: 6 }
 *             example:
 *               message: "User reflections and notes cleared successfully"
 *               userId: 42
 *               deletedCounts:
 *                 notePrompts: 8
 *                 userNotes: 3
 *                 storyReflections: 6
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string, example: "User not found with id: 42" }
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       422:
 *         description: Validation error — invalid userId
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:  { type: integer, example: 0 }
 *                 message: { type: string,  example: "Validation Error" }
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.delete('/clearReflectionAndNotes/:userId', auth, [
  param('userId').isInt({ min: 1 }).withMessage('userId must be a positive integer'),
], clearReflectionAndNotesHandler);

module.exports = router;
