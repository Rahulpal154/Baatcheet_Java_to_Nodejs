'use strict';

const { matchedData } = require('express-validator');
const { handleValidationErrors } = require('../utils/helper');
const { saveUser, checkExistingUser, updateUser, getUser, deleteUser, updateLanguage, markStoryAsRead, addStoryBookmark ,getUserList, deleteStoryBookmark, addUserSubmission, getUserSubmission, getUserSubmissions, deleteUserSubmission, getUserSearch, getUserMetrics, resetUserInteraction, clearUserReflectionAndNotes } = require('../services/userService');

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_OPTS = { httpOnly: true, path: '/', maxAge: COOKIE_MAX_AGE_MS, sameSite: 'Lax' };

const setUserCookies = (res, jwtToken, avatarPath) => {
  res.cookie('user_type',       'USER',            COOKIE_OPTS);
  res.cookie('login_timestamp', String(Date.now()), COOKIE_OPTS);
  res.cookie('jwt_token',        jwtToken,          COOKIE_OPTS);
  if (avatarPath) res.cookie('avatar_file_path', avatarPath, COOKIE_OPTS);
};

// ── POST /users/register  (#1258) ─────────────────────────────────────────────
const registerUser = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const data = matchedData(req, { includeOptionals: true });
    const result = await saveUser({
      userName: data.userName, userAge: data.userAge,
      userMobile: data.userMobile || null, userGenderId: data.userGenderId,
      languageEnum: data.languageEnum !== undefined ? data.languageEnum : 0,
      locationId: data.locationId, locationName: data.locationName,
      userEmail: data.userEmail, userAvatar: data.userAvatar || null,
      triggers: data.triggers || [], userTag: data.userTag || [],
      userCommunity: data.userCommunity || [],
      isEmailLogin: data.isEmailLogin !== undefined ? data.isEmailLogin : true,
    });
    return res.status(201).json(result);
  } catch (err) {
    console.error('[registerUser]', err.message);
    if (err.status === 409) return res.status(409).json({ message: err.message });
    if (err.status === 404) return res.status(404).json({ message: err.message });
    if (err.status === 400) return res.status(400).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

// ── POST /users/login  (#1257) ────────────────────────────────────────────────
const loginUser = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const data = matchedData(req, { includeOptionals: true });
    const result = await checkExistingUser(data.userEmail || null, data.userMobile || null);
    if (result.userExists === 'TRUE') {
      res.clearCookie('user_type',        { path: '/' });
      res.clearCookie('login_timestamp',  { path: '/' });
      res.clearCookie('jwt_token',        { path: '/' });
      res.clearCookie('avatar_file_path', { path: '/' });
      setUserCookies(res, result.jwtToken, null);
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error('[loginUser]', err.message);
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

// ── PUT /users/:userId  (#1259) ───────────────────────────────────────────────
const updateUserById = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { userId } = req.params;
    const data = matchedData(req, { includeOptionals: true });

    const updated = await updateUser(Number(userId), {
      userName:      data.userName,
      userAge:       data.userAge,
      userAvatar:    data.userAvatar,
      userGenderId:  data.userGenderId,
      languageEnum:  data.languageEnum,
      locationId:    data.locationId,
      locationName:  data.locationName,
      userEmail:     data.userEmail,
      userMobile:    data.userMobile,
      triggers:      data.triggers      || [],
      userTag:       data.userTag       || [],
      userCommunity: data.userCommunity || [],
    });

    return res.status(200).json(updated);
  } catch (err) {
    console.error('[updateUserById]', err.message);
    if (err.status === 404) return res.status(404).json({ message: err.message });
    if (err.status === 409) return res.status(409).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1260 — Get User Handler
// ─────────────────────────────────────────────────────────────────────────────

const getUserById = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { userId } = req.params;

    const user = await getUser(Number(userId));
    return res.status(200).json(user);
  } catch (err) {
    console.error('[getUserById]', err.message);
    if (err.status === 404) return res.status(404).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1261 — Delete User
// ─────────────────────────────────────────────────────────────────────────────

const deleteUserById = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { userId } = req.params;

    const result = await deleteUser(Number(userId));
    return res.status(200).json(result);
  } catch (err) {
    console.error('[deleteUserById]', err.message);
    if (err.status === 404) return res.status(404).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1262 — Update Language for User
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /users/language  (Swagger corrected)
//
// ❌ OLD: PATCH /users/:userId/language
//   const { userId } = req.params;   ← userId from URL path (WRONG)
//
// ✅ NEW: PATCH /users/language
//   userId from req.decodedToken.user_id   ← from JWT token (auth required)
//   languageEnum from request body (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
const updateLanguageById = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;

    // userId from JWT token — NOT from URL path param
    const userId = req.decodedToken.user_id;
    if (!userId) {
      return res.status(401).json({ message: 'Unable to identify user from token' });
    }

    const data = matchedData(req, { includeOptionals: true });
    const result = await updateLanguage(Number(userId), data.languageEnum);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[updateLanguageById]', err.message);
    if (err.status === 404) return res.status(404).json({ message: err.message });
    if (err.status === 400) return res.status(400).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1263 — Mark Story As Read
//
// ❌ OLD handler name: readStoryById
// ✅ NEW handler name: markStoryAsReadHandler
//
// ❌ OLD param extraction:
//   const { userId, storyId } = req.params;
//   → userId was taken from URL path ← WRONG (Java has no userId in path here)
//
// ✅ NEW param extraction:
//   storyId  → req.params.storyId         (path param — always present)
//   userId   → req.decodedToken?.user_id  (from JWT token — optional auth)
//   visitorId→ req.query.visitorId        (query param — for anonymous users)
//
// ❌ OLD response:
//   return res.status(200).json(story);   ← returned full story JSON (WRONG)
//
// ✅ NEW response:
//   return res.status(200).send();        ← void (Java returns void)
// ─────────────────────────────────────────────────────────────────────────────
const markStoryAsReadHandler = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;
 
    // storyId from path param
    const { storyId } = req.params;
 
    // userId from JWT token (optional — auth is optional on this endpoint)
    const userId = req.decodedToken?.user_id || null;
 
    // visitorId from query param (optional — for anonymous users)
    const visitorId = req.query.visitorId || null;
 
    await markStoryAsRead(Number(storyId), userId ? Number(userId) : null, visitorId);
 
    // Java returns void — respond with HTTP 200 and no body
    return res.status(200).send();
  } catch (err) {
    console.error('[markStoryAsReadHandler]', err.message);
    if (err.status === 404) return res.status(404).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1264 — Add Story Bookmark
//
// ❌ OLD param extraction:
//   const { userId, storyId } = req.params;
//   → userId was taken from URL path ← WRONG
//   Java endpoint: POST /users/bookmark/{storyId} — only storyId in path
//
// ✅ NEW param extraction:
//   storyId → req.params.storyId        (path param)
//   userId  → req.decodedToken.user_id  (from JWT token — auth is required)
// ─────────────────────────────────────────────────────────────────────────────
const addBookmark = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;
 
    // storyId from path param (only param in URL)
    const { storyId } = req.params;
 
    // userId from JWT token (required — auth middleware enforced on this route)
    const userId = req.decodedToken.user_id;
 
    if (!userId) {
      return res.status(401).json({ message: 'Unable to identify user from token' });
    }
 
    const result = await addStoryBookmark(Number(userId), Number(storyId));
    return res.status(201).json(result);
  } catch (err) {
    console.error('[addBookmark]', err.message);
    if (err.status === 404) return res.status(404).json({ message: err.message });
    if (err.status === 409) return res.status(409).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1265 — Get User List
// ─────────────────────────────────────────────────────────────────────────────

const getUserListHandler = async (req, res) => {
  try {
    // Use nullish coalescing (??) instead of ||
    // so that page=0 and limit=0 are not silently converted
    // to default values and can be validated correctly.
    
    // const page = parseInt(req.query.page) || 1;
    // const limit = parseInt(req.query.limit) || 10;

    const page = parseInt(req.query.page ?? 1);
    const limit = parseInt(req.query.limit ?? 10);

    const searchTerm = req.query.search || null;

    if (page < 1) {
      return res.status(422).json({ message: 'Page must be >= 1' });
    }
    if (limit < 1 || limit > 100) {
      return res.status(422).json({ message: 'Limit must be between 1 and 100' });
    }

    const result = await getUserList(page, limit, searchTerm);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[getUserListHandler]', err.message);
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1266 — Delete Bookmark
// ─────────────────────────────────────────────────────────────────────────────

const deleteBookmark = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { userId, storyId } = req.params;

    const result = await deleteStoryBookmark(Number(userId), Number(storyId));
    return res.status(200).json(result);
  } catch (err) {
    console.error('[deleteBookmark]', err.message);
    if (err.status === 404) return res.status(404).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1267 — User Submissions (Add, Get, Delete)
// ─────────────────────────────────────────────────────────────────────────────

const addSubmission = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { userId } = req.params;
    const data = matchedData(req, { includeOptionals: true });

    const result = await addUserSubmission(Number(userId), {
      submissionTitle: data.submissionTitle,
      submissionContent: data.submissionContent,
      submissionStatus: data.submissionStatus || 'pending',
    });
    return res.status(201).json(result);
  } catch (err) {
    console.error('[addSubmission]', err.message);
    if (err.status === 404) return res.status(404).json({ message: err.message });
    if (err.status === 400) return res.status(400).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /users/submission/{submissionId}  (Swagger corrected)
//
// ❌ OLD: GET /users/:userId/submissions/:submissionId
//   const { userId, submissionId } = req.params;  ← userId from path (WRONG)
//   getUserSubmission(Number(userId), Number(submissionId))
//
// ✅ NEW: GET /users/submission/:submissionId
//   submissionId from req.params.submissionId  (path param — required)
//   userId from req.decodedToken?.user_id      (JWT token — optional auth)
//   Signature change: getUserSubmission(submissionId, userId)
// ─────────────────────────────────────────────────────────────────────────────
const getSubmission = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;

    // submissionId from path param only
    const { submissionId } = req.params;

    // userId from JWT token (optional — auth is optional per Java Swagger)
    const userId = req.decodedToken?.user_id || null;

    const result = await getUserSubmission(Number(submissionId), userId ? Number(userId) : null);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[getSubmission]', err.message);
    if (err.status === 404) return res.status(404).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

const getSubmissions = async (req, res) => {
  try {
    const { userId } = req.params;
    // const page = parseInt(req.query.page) || 1;
    // const limit = parseInt(req.query.limit) || 10;

    const page = parseInt(req.query.page ?? 1);
    const limit = parseInt(req.query.limit ?? 10);

    if (page < 1) {
      return res.status(422).json({ message: 'Page must be >= 1' });
    }
    if (limit < 1 || limit > 100) {
      return res.status(422).json({ message: 'Limit must be between 1 and 100' });
    }

    const result = await getUserSubmissions(Number(userId), page, limit);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[getSubmissions]', err.message);
    if (err.status === 404) return res.status(404).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

const deleteSubmission = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { userId, submissionId } = req.params;

    const result = await deleteUserSubmission(Number(userId), Number(submissionId));
    return res.status(200).json(result);
  } catch (err) {
    console.error('[deleteSubmission]', err.message);
    if (err.status === 404) return res.status(404).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1268 — Get User Search Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /users/search?query=&pageIndex=&visitorId=
 *
 * Java contract (UserController.getUserSearch):
 *   - query     : string search term (optional, blank = all users)
 *   - pageIndex : 0-based integer page number (default 0)
 *   - visitorId : optional visitor UUID (ignored in DB query, passed for future use)
 *   - Authorization header is OPTIONAL (public endpoint in Java)
 *
 * HTTP 200 on success, 422 on invalid pageIndex, 500 on server error.
 */
const getUserSearchHandler = async (req, res) => {
  try {
    const query     = req.query.query     || '';
    // Use nullish coalescing so pageIndex=0 is treated as valid (not converted to default)
    const pageIndex = parseInt(req.query.pageIndex ?? 0);
    const visitorId = req.query.visitorId || null;

    if (isNaN(pageIndex) || pageIndex < 0) {
      return res.status(422).json({ message: 'pageIndex must be a non-negative integer' });
    }

    const result = await getUserSearch(query, pageIndex, visitorId);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[getUserSearchHandler]', err.message);
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1269 — Get User Metrics Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /users/metrics
 *
 * Java contract (UserController.getUserMetrics):
 *   - Authorization header is REQUIRED (Bearer JWT).
 *   - User identity is derived from the decoded JWT token (req.decodedToken.user_id).
 *   - No path parameters — the authenticated user's own metrics are returned.
 *   - 404 if the userId from the token is not found in user_master.
 *   - 500 on unexpected server error.
 *
 * Note on compatibility route:
 *   The user frontend also calls /users/{id}/metrics (legacy path).
 *   Per the migration plan, we must preserve old frontend routes.
 *   A compatibility route GET /:userId/metrics is also registered in userRoute.js
 *   pointing to this same handler, but reading userId from req.params.userId instead.
 *   Both routes share the same service function.
 */
const getUserMetricsHandler = async (req, res) => {
  try {
    // Primary: token-derived userId (Java production behaviour)
    const userId = req.decodedToken?.user_id;

    if (!userId) {
      return res.status(401).json({ message: 'Unable to identify user from token' });
    }

    const result = await getUserMetrics(Number(userId));
    return res.status(200).json(result);
  } catch (err) {
    console.error('[getUserMetricsHandler]', err.message);
    if (err.status === 404) return res.status(404).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

/**
 * Compatibility handler for legacy frontend path: GET /users/:userId/metrics
 * Per migration plan: "preserve old frontend routes so existing frontends continue to work."
 * Uses path param userId instead of token-derived userId.
 */
const getUserMetricsByIdHandler = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { userId } = req.params;

    const result = await getUserMetrics(Number(userId));
    return res.status(200).json(result);
  } catch (err) {
    console.error('[getUserMetricsByIdHandler]', err.message);
    if (err.status === 404) return res.status(404).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1270 — Reset User Interactions Handler
// ─────────────────────────────────────────────────────────────────────────────
 
/**
 * DELETE /users/resetInteraction/:userId
 *
 * Java contract (UserController.resetInteraction):
 *   - Requires Authorization header (Bearer JWT).
 *   - userId comes from path param.
 *   - Clears user_story_interaction and user_reaction_map for the user.
 *   - Returns HTTP 200 with Map<String,String> message body.
 *   - Returns 404 if user not found.
 *   - Returns 500 on unexpected error.
 */
const resetInteractionHandler = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { userId } = req.params;
 
    const result = await resetUserInteraction(Number(userId));
    return res.status(200).json(result);
  } catch (err) {
    console.error('[resetInteractionHandler]', err.message);
    if (err.status === 404) return res.status(404).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};
 
// ─────────────────────────────────────────────────────────────────────────────
// Issue #1270 — Clear Reflections and Notes Handler
// ─────────────────────────────────────────────────────────────────────────────
 
/**
 * DELETE /users/clearReflectionAndNotes/:userId
 *
 * Java contract (UserController.clearReflectionAndNotes):
 *   - Requires Authorization header (Bearer JWT).
 *   - userId comes from path param.
 *   - Clears note_prompts → user_notes → story_reflections for the user
 *     (in FK-safe transactional order).
 *   - Returns HTTP 200 with Map<String,String> message body.
 *   - Returns 404 if user not found.
 *   - Returns 500 on unexpected error.
 */
const clearReflectionAndNotesHandler = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;
    const { userId } = req.params;
 
    const result = await clearUserReflectionAndNotes(Number(userId));
    return res.status(200).json(result);
  } catch (err) {
    console.error('[clearReflectionAndNotesHandler]', err.message);
    if (err.status === 404) return res.status(404).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

module.exports = { registerUser, loginUser, updateUserById, getUserById, deleteUserById, updateLanguageById, markStoryAsReadHandler, addBookmark, getUserListHandler, deleteBookmark, addSubmission, getSubmission, getSubmissions, deleteSubmission, getUserSearchHandler, getUserMetricsHandler, getUserMetricsByIdHandler, resetInteractionHandler, clearReflectionAndNotesHandler };
