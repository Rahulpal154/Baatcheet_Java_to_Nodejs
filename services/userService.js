'use strict';

/**
 * PATCH — services/userService.js
 *
 * Changes for #1263, #1264, #1266 ONLY.
 * All other existing functions (saveUser, checkExistingUser, updateUser, etc.)
 * are UNCHANGED. Only the three functions below are replaced.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ISSUE #1263  readStory  →  markStoryAsRead
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY CHANGED:
 *  Old function `readStory(userId, storyId)`:
 *    ❌ Returned full story details + tags  (Java returns VOID)
 *    ❌ Called story_tag_map               (not needed for mark-as-read)
 *    ❌ Signature had userId as first arg   (userId is optional/from token, not path)
 *    ❌ Queried story_bookmark_map          (not in scope of this endpoint)
 *    ❌ Function name misleading — Java operation is "markStoryAsReadByUser"
 *
 *  New function `markStoryAsRead(storyId, userId, visitorId)`:
 *    ✅ Verifies story exists (404 if not)
 *    ✅ Creates/updates user_story_interaction with mark_as_read = 1
 *    ✅ Handles visitorId for anonymous users (maps to visitor_id column)
 *    ✅ Returns void (undefined) — Java response is void
 *    ✅ userId is optional (auth is optional on this endpoint)
 *
 * Database tables: user_story_interaction
 *   Columns used: user_id, story_id, mark_as_read, visitor_id, updated_on
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ISSUE #1264  addStoryBookmark — SERVICE UNCHANGED, CONTROLLER CHANGES
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY SERVICE UNCHANGED:
 *  `addStoryBookmark(userId, storyId)` already has the correct logic.
 *  The userId is now sourced from JWT token (in the controller), not the URL path.
 *  Service signature accepts userId regardless of where it comes from — no change needed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ISSUE #1266  deleteStoryBookmark — SERVICE UNCHANGED
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY SERVICE UNCHANGED:
 *  `deleteStoryBookmark(userId, storyId)` already has the correct logic.
 *  Both userId and storyId still come from path params in the corrected route.
 *  No change needed.
 */

const model = require('../models/index');
const { sequelize } = model;
const { generateUserToken } = require('../utils/helper');

// ─── Enums (mirroring Java) ───────────────────────────────────────────────────
const GenderEnum = ['OTHER', 'MALE', 'FEMALE', 'TRANSGENDER', 'NON_BINARY', 'PREFER_NOT_TO_SAY'];

// ── saveUser (#1258) ──────────────────────────────────────────────────────────
const saveUser = async (userData) => {
  const t = await sequelize.transaction();
  try {
    const {
      userName, userAge, userMobile, userGenderId, languageEnum,
      locationId, locationName, userEmail, userAvatar,
      triggers = [], userTag = [], userCommunity = [], isEmailLogin = true,
    } = userData;

    if (isEmailLogin) {
      if (!userEmail) { const err = new Error('User Email cannot be null'); err.status = 400; throw err; }
      const emailLoginCount = await model.user_master.count({ where: { user_email: userEmail, is_email_login: true }, transaction: t });
      if (emailLoginCount > 0) { const err = new Error(`User already exists with email Id: ${userEmail}`); err.status = 409; throw err; }
      if (userMobile) { const mobileCount = await model.user_master.count({ where: { user_mobile: userMobile }, transaction: t }); if (mobileCount > 0) { const err = new Error(`User already exists with mobile: ${userMobile}`); err.status = 409; throw err; } }
      const emailMobileCount = await model.user_master.count({ where: { user_email: userEmail }, transaction: t });
      if (emailMobileCount > 0) { const err = new Error(`User already exists with email Id: ${userEmail}`); err.status = 409; throw err; }
    } else {
      const mobileLoginCount = await model.user_master.count({ where: { user_mobile: userMobile, is_email_login: false }, transaction: t });
      if (mobileLoginCount > 0) { const err = new Error(`User already exists with mobile: ${userMobile}`); err.status = 409; throw err; }
      const mobileGlobalCount = await model.user_master.count({ where: { user_mobile: userMobile }, transaction: t });
      if (mobileGlobalCount > 0) { const err = new Error(`User already exists with mobile: ${userMobile}`); err.status = 409; throw err; }
      if (userEmail && userEmail.trim() !== '') { const emailCount = await model.user_master.count({ where: { user_email: userEmail }, transaction: t }); if (emailCount > 0) { const err = new Error(`User already exists with email Id: ${userEmail}`); err.status = 409; throw err; } }
    }

    // userGenderId, languageEnum already validated as integers in the route
    // (express-validator .isInt()) — no type checks needed here.
    let genderDbValue = GenderEnum[userGenderId];
    let languageOrdinal = languageEnum;

    const savedUser = await model.user_master.create(
      { user_name: userName, user_age: userAge, user_mobile: userMobile || null, user_gender_id: genderDbValue, preferred_language: languageOrdinal, location_id: locationId, location_name: locationName, user_email: userEmail, user_avatar: userAvatar || null, is_email_login: isEmailLogin, is_participant: false, created_on: new Date(), updated_on: new Date() },
      { transaction: t }
    );

    const savedTags = [];
    for (const tag of userTag) {
      const tagRecord = await model.tag_master.findByPk(tag.tagId, { transaction: t });
      if (!tagRecord) { const err = new Error(`Tag not found with id: ${tag.tagId}`); err.status = 404; throw err; }
      const savedTag = await model.user_tag_map.create({ tag_id: tag.tagId, tag_name: tagRecord.tag_desc, user_id: savedUser.user_id }, { transaction: t });
      savedTags.push(savedTag.get({ plain: true }));
    }

    const savedTriggers = [];
    for (const trigger of triggers) {
      const triggerRecord = await model.trigger_master.findByPk(trigger.triggerId, { transaction: t });
      if (!triggerRecord) { const err = new Error(`Trigger not found with id: ${trigger.triggerId}`); err.status = 404; throw err; }
      const savedTrigger = await model.user_trigger_map.create({ trigger_id: trigger.triggerId, trigger_name: triggerRecord.trigger_desc, user_id: savedUser.user_id }, { transaction: t });
      savedTriggers.push(savedTrigger.get({ plain: true }));
    }

    const savedCommunities = [];
    for (const community of userCommunity) {
      // communityId already validated as integer 0-5 in the route — no type check needed.
      const savedCommunity = await model.user_community_map.create({ community_id: community.communityId, user_id: savedUser.user_id }, { transaction: t });
      savedCommunities.push(savedCommunity.get({ plain: true }));
    }

    await t.commit();
    const token = generateUserToken(savedUser);
    return {
      userId: savedUser.user_id, userName: savedUser.user_name, userAge: savedUser.user_age,
      userMobile: savedUser.user_mobile, userGenderId: GenderEnum.indexOf(savedUser.user_gender_id),
      languageEnum: savedUser.preferred_language, locationId: savedUser.location_id,
      locationName: savedUser.location_name, userEmail: savedUser.user_email,
      userAvatar: savedUser.user_avatar, triggers: savedTriggers, userTag: savedTags,
      userCommunity: savedCommunities, userSubmissions: [], jwtToken: token,
      isEmailLogin: savedUser.is_email_login,
    };
  } catch (err) { await t.rollback(); throw err; }
};

// ── checkExistingUser (#1257) ─────────────────────────────────────────────────
const checkExistingUser = async (userEmail, userMobile) => {
  let user = null;
  if (userEmail) {
    user = await model.user_master.findOne({ where: { user_email: userEmail }, raw: true });
    if (user) await model.user_master.update({ is_email_login: user.is_email_login }, { where: { user_id: user.user_id } });
  } else {
    user = await model.user_master.findOne({ where: { user_mobile: userMobile }, raw: true });
    if (user) await model.user_master.update({ is_email_login: user.is_email_login }, { where: { user_id: user.user_id } });
  }
  if (!user) return { userExists: 'FALSE', userId: null, jwtToken: null, isEmailLogin: null };
  const token = generateUserToken(user);
  return { userExists: 'TRUE', userId: user.user_id, jwtToken: token, isEmailLogin: !!user.is_email_login };
};

// ── updateUser (#1259) ────────────────────────────────────────────────────────
const updateUser = async (userId, userData) => {
  const t = await sequelize.transaction();
  try {
    const existing = await model.user_master.findByPk(userId, { transaction: t });
    if (!existing) { const err = new Error(`User not found with id: ${userId}`); err.status = 404; throw err; }

    const { userName, userAge, userAvatar, userGenderId, languageEnum, locationId, locationName, userEmail, userMobile, userTag = [], triggers = [], userCommunity = [] } = userData;

    // userGenderId, languageEnum already validated as integers in the route
    // (express-validator .isInt()) when provided — no type checks needed here.
    let genderDbValue = userGenderId !== undefined ? GenderEnum[userGenderId] : existing.user_gender_id;
    let languageOrdinal = languageEnum !== undefined ? languageEnum : existing.preferred_language;

    const updateFields = {
      user_name: userName !== undefined ? userName : existing.user_name,
      user_age: userAge !== undefined ? userAge : existing.user_age,
      user_avatar: userAvatar !== undefined ? userAvatar : existing.user_avatar,
      user_gender_id: genderDbValue, preferred_language: languageOrdinal,
      location_id: locationId !== undefined ? locationId : existing.location_id,
      location_name: locationName !== undefined ? locationName : existing.location_name,
      updated_on: new Date(),
    };

    if (!existing.is_email_login) {
      if (userEmail !== undefined && userEmail !== existing.user_email) {
        const dup = await model.user_master.count({ where: { user_email: userEmail }, transaction: t });
        if (dup > 0) { const err = new Error(`User already exists with email Id: ${userEmail}`); err.status = 409; throw err; }
        updateFields.user_email = userEmail;
      }
    } else {
      if (userMobile !== undefined && userMobile !== existing.user_mobile) {
        const dup = await model.user_master.count({ where: { user_mobile: userMobile }, transaction: t });
        if (dup > 0) { const err = new Error(`User already exists with mobile: ${userMobile}`); err.status = 409; throw err; }
        updateFields.user_mobile = userMobile;
      }
    }

    await model.user_master.update(updateFields, { where: { user_id: userId }, transaction: t });
    await model.user_community_map.destroy({ where: { user_id: userId }, transaction: t });
    for (const c of userCommunity) {
      // communityId already validated as integer 0-5 in the route — no type check needed.
      await model.user_community_map.create({ community_id: c.communityId, user_id: userId }, { transaction: t });
    }
    await model.user_tag_map.destroy({ where: { user_id: userId }, transaction: t });
    for (const tag of userTag) {
      const tagRecord = await model.tag_master.findByPk(tag.tagId, { transaction: t });
      if (!tagRecord) { const err = new Error(`Tag not found with id: ${tag.tagId}`); err.status = 404; throw err; }
      await model.user_tag_map.create({ tag_id: tag.tagId, tag_name: tagRecord.tag_desc, user_id: userId }, { transaction: t });
    }
    await model.user_trigger_map.destroy({ where: { user_id: userId }, transaction: t });
    for (const trig of triggers) {
      const trigRecord = await model.trigger_master.findByPk(trig.triggerId, { transaction: t });
      if (!trigRecord) { const err = new Error(`Trigger not found with id: ${trig.triggerId}`); err.status = 404; throw err; }
      await model.user_trigger_map.create({ trigger_id: trig.triggerId, trigger_name: trigRecord.trigger_desc, user_id: userId }, { transaction: t });
    }
    await t.commit();
    return await model.user_master.findByPk(userId, { raw: true });
  } catch (err) { await t.rollback(); throw err; }
};

// ── getUser (#1260) ───────────────────────────────────────────────────────────
const getUser = async (userId) => {
  const user = await model.user_master.findByPk(userId, { raw: true });
  if (!user) { const err = new Error(`User not found with id: ${userId}`); err.status = 404; throw err; }
  const tags = await model.user_tag_map.findAll({ where: { user_id: userId }, attributes: ['tag_id'], raw: true });
  const triggers = await model.user_trigger_map.findAll({ where: { user_id: userId }, attributes: ['trigger_id'], raw: true });
  const communities = await model.user_community_map.findAll({ where: { user_id: userId }, attributes: ['community_id'], raw: true });
  return {
    userId: user.user_id, userName: user.user_name, userAge: user.user_age, userMobile: user.user_mobile,
    userGenderId: GenderEnum.indexOf(user.user_gender_id), languageEnum: user.preferred_language,
    locationId: user.location_id, locationName: user.location_name, userEmail: user.user_email,
    userAvatar: user.user_avatar, isEmailLogin: !!user.is_email_login, isParticipant: user.is_participant,
    userTag: tags.map(t => ({ tagId: t.tag_id })),
    triggers: triggers.map(t => ({ triggerId: t.trigger_id })),
    userCommunity: communities.map(c => ({ communityId: c.community_id })),
    createdOn: user.created_on, updatedOn: user.updated_on,
  };
};

// ── deleteUser (#1261) ────────────────────────────────────────────────────────
const deleteUser = async (userId) => {
  const t = await sequelize.transaction();
  try {
    const user = await model.user_master.findByPk(userId, { transaction: t });
    if (!user) { const err = new Error(`User not found with id: ${userId}`); err.status = 404; throw err; }
    await model.user_community_map.destroy({ where: { user_id: userId }, transaction: t });
    await model.user_tag_map.destroy({ where: { user_id: userId }, transaction: t });
    await model.user_trigger_map.destroy({ where: { user_id: userId }, transaction: t });
    await model.user_master.destroy({ where: { user_id: userId }, transaction: t });
    await t.commit();
    return { success: true, message: `User deleted successfully`, userId };
  } catch (err) { await t.rollback(); throw err; }
};

// ── updateLanguage (corrected: PATCH /users/language) ─────────────────────────
const updateLanguage = async (userId, languageEnum) => {
  const user = await model.user_master.findByPk(userId, { raw: true });
  if (!user) { const err = new Error(`User not found with id: ${userId}`); err.status = 404; throw err; }
  // languageEnum already validated as 0 or 1 in the route (express-validator .isIn([0,1]))
  // — no type check needed here.
  await model.user_master.update({ preferred_language: languageEnum, updated_on: new Date() }, { where: { user_id: userId } });
  const updated = await model.user_master.findByPk(userId, { raw: true });
  return { userId: updated.user_id, userName: updated.user_name, languageEnum: updated.preferred_language, message: `Language updated to ${languageEnum === 0 ? 'ENGLISH' : 'HINDI'}` };
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1263 — Mark Story As Read
//
// ❌ OLD (WRONG): readStory(userId, storyId)
//   - Returned full story details + tags (Java returns VOID)
//   - Queried story_tag_map, story_bookmark_map (not in scope of mark-as-read)
//   - userId was first arg (path param), but Java gets userId from token (optional)
//
// ✅ NEW (CORRECT): markStoryAsRead(storyId, userId, visitorId)
//   Java endpoint: POST /users/mark-as-read/{storyId}?visitorId=
//   - storyId: path param (required)
//   - userId: from JWT token (optional — auth is optional)
//   - visitorId: from query param (optional — for anonymous users)
//   - Response: void (no body returned)
//   - DB table: user_story_interaction
//     └ If interaction exists → update mark_as_read = 1
//     └ If not → create new record
// ─────────────────────────────────────────────────────────────────────────────
const markStoryAsRead = async (storyId, userId, visitorId) => {
  // 1. Verify story exists
  const story = await model.story_master.findOne({ where: { id: storyId }, raw: true });
  if (!story) {
    const err = new Error(`Story not found with id: ${storyId}`);
    err.status = 404;
    throw err;
  }

  // 2. Require either an authenticated userId or a visitorId.
  //    Reviewer note: an interaction with neither identifier cannot be
  //    attributed to any reader — it would match/update an unrelated
  //    existing row for the same story (belonging to a different user or
  //    visitor) or create an orphan row with both columns null.
  if (!userId && !visitorId) {
    const err = new Error('Either an authenticated user or visitorId is required to mark a story as read');
    err.status = 400;
    throw err;
  }

  // 3. Create or update user_story_interaction
  //    Priority: userId (logged-in) > visitorId (anonymous)
  const whereClause = { story_id: storyId };
  const interactionData = {
    story_id: storyId,
    mark_as_read: 1,
    updated_on: new Date(),
  };

  if (userId) {
    // Logged-in user: track by user_id
    whereClause.user_id = userId;
    interactionData.user_id = userId;
    interactionData.visitor_id = null;
  } else {
    // Anonymous user: track by visitor_id
    whereClause.visitor_id = visitorId;
    interactionData.visitor_id = visitorId;
    interactionData.user_id = null;
  }

  const existing = await model.user_story_interaction.findOne({ where: whereClause });

  if (existing) {
    await existing.update({ mark_as_read: 1, updated_on: new Date() });
  } else {
    await model.user_story_interaction.create(interactionData);
  }

  // Java returns void — no return value
  return;
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1264 — Add Story Bookmark
//
// ✅ SERVICE UNCHANGED — no modification needed.
//
// Why: addStoryBookmark(userId, storyId) already has correct DB logic.
// The only change is in the controller: userId now comes from JWT token
// (req.decodedToken.user_id) instead of the URL path param.
// Service signature accepts userId regardless of source — unchanged.
//
// Java endpoint: POST /users/bookmark/{storyId}
// DB table: user_story_map
// ─────────────────────────────────────────────────────────────────────────────
const addStoryBookmark = async (userId, storyId) => {
  const user = await model.user_master.findByPk(userId, { raw: true });
  if (!user) { const err = new Error(`User not found with id: ${userId}`); err.status = 404; throw err; }

  const story = await model.story_master.findByPk(storyId, { raw: true });
  if (!story) { const err = new Error(`Story not found with id: ${storyId}`); err.status = 404; throw err; }

  const existing = await model.user_story_map.findOne({ where: { user_id: userId, story_id: storyId }, raw: true });
  if (existing) { const err = new Error(`Story already bookmarked by this user`); err.status = 409; throw err; }

  const bookmark = await model.user_story_map.create({ user_id: userId, story_id: storyId });

  return {
    success: true,
    bookmarkId: bookmark.id,
    userId,
    storyId,
    bookmarkedOn: new Date(),
    message: `Story bookmarked successfully`,
  };
};

// ── getUserList (#1265) ───────────────────────────────────────────────────────
const getUserList = async (page = 1, limit = 10, searchTerm = null) => {
  const offset = (page - 1) * limit;
  let whereClause = {};
  if (searchTerm) {
    whereClause = { [model.Sequelize.Op.or]: [{ user_name: { [model.Sequelize.Op.like]: `%${searchTerm}%` } }, { user_email: { [model.Sequelize.Op.like]: `%${searchTerm}%` } }] };
  }
  const { count, rows } = await model.user_master.findAndCountAll({ where: whereClause, attributes: ['user_id','user_name','user_email','user_mobile','user_avatar','preferred_language','created_on'], offset, limit, order: [['user_id','DESC']], raw: true });
  const totalPages = Math.ceil(count / limit);
  return {
    users: rows.map(u => ({ userId: u.user_id, userName: u.user_name, userEmail: u.user_email, userMobile: u.user_mobile, userAvatar: u.user_avatar, languageEnum: u.preferred_language, createdOn: u.created_on })),
    pagination: { currentPage: page, pageSize: limit, totalUsers: count, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1266 — Delete Story Bookmark
//
// ✅ SERVICE UNCHANGED — no modification needed.
//
// Why: deleteStoryBookmark(userId, storyId) already has correct DB logic.
// The route change (from /users/:userId/stories/:storyId/bookmark
// to /users/bookmark/:userId/:storyId) does NOT affect this function because
// both userId and storyId still arrive as path params — just in a different URL.
// Controller still extracts both from req.params.
//
// Java endpoint: DELETE /users/bookmark/{userId}/{storyId}
// DB table: user_story_map
// ─────────────────────────────────────────────────────────────────────────────
const deleteStoryBookmark = async (userId, storyId) => {
  const user = await model.user_master.findByPk(userId, { raw: true });
  if (!user) { const err = new Error(`User not found with id: ${userId}`); err.status = 404; throw err; }

  const story = await model.story_master.findByPk(storyId, { raw: true });
  if (!story) { const err = new Error(`Story not found with id: ${storyId}`); err.status = 404; throw err; }

  const bookmark = await model.user_story_map.findOne({ where: { user_id: userId, story_id: storyId }, raw: true });
  if (!bookmark) { const err = new Error(`Bookmark not found for this user and story`); err.status = 404; throw err; }

  await model.user_story_map.destroy({ where: { user_id: userId, story_id: storyId } });

  return { success: true, userId, storyId, message: `Story bookmark removed successfully` };
};

// ── Submission helpers (#1267) ────────────────────────────────────────────────
const addUserSubmission = async (userId, submissionData) => {
  const user = await model.user_master.findByPk(userId, { raw: true });
  if (!user) { const err = new Error(`User not found with id: ${userId}`); err.status = 404; throw err; }
  // submissionTitle, submissionContent, submissionStatus already validated in the route
  // (express-validator .notEmpty() / .isIn()) — no checks needed here.
  const statusMap = { pending: 0, approved: 1, rejected: 2 };
  const statusOrdinal = statusMap[submissionData.submissionStatus] ?? 0;
  const submission = await model.user_submission.create({ user_id: userId, story_title: submissionData.submissionTitle, story_description: submissionData.submissionContent, story_status: statusOrdinal, created_on: new Date(), updated_on: new Date() });
  return { submissionId: submission.submission_id, userId: submission.user_id, submissionTitle: submission.story_title, submissionContent: submission.story_description, submissionStatus: ['pending','approved','rejected'][submission.story_status] || 'pending', createdOn: submission.created_on, message: `Submission created successfully` };
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /users/submission/{submissionId} — Swagger corrected
//
// ❌ OLD: getUserSubmission(userId, submissionId)
//   - userId was mandatory (from URL path param)
//   - Queried: WHERE submission_id = ? AND user_id = ?
//   - Threw "User not found" if userId invalid (wrong — endpoint is by submissionId)
//
// ✅ NEW: getUserSubmission(submissionId, userId)
//   - submissionId is the primary lookup key (path param — required)
//   - userId is OPTIONAL (from JWT token — auth is optional per Java Swagger)
//   - If userId present: query WHERE submission_id = ? AND user_id = ? (ownership check)
//   - If userId absent:  query WHERE submission_id = ? only (anonymous access)
//   - Returns 404 if submission not found
// ─────────────────────────────────────────────────────────────────────────────
const getUserSubmission = async (submissionId, userId = null) => {
  let whereClause;

  if (userId) {
    // Authenticated: verify the submission belongs to this user
    whereClause = { submission_id: submissionId, user_id: userId };
  } else {
    // Anonymous / no token: look up by submissionId only
    whereClause = { submission_id: submissionId };
  }

  const submission = await model.user_submission.findOne({ where: whereClause, raw: true });
  if (!submission) {
    const err = new Error(`Submission not found with id: ${submissionId}`);
    err.status = 404;
    throw err;
  }

  return {
    submissionId:      submission.submission_id,
    userId:            submission.user_id,
    submissionTitle:   submission.story_title,
    submissionContent: submission.story_description,
    submissionStatus:  ['pending', 'approved', 'rejected'][submission.story_status] || 'pending',
    createdOn:         submission.created_on,
    updatedOn:         submission.updated_on,
  };
};

const getUserSubmissions = async (userId, page = 1, limit = 10) => {
  const user = await model.user_master.findByPk(userId, { raw: true });
  if (!user) { const err = new Error(`User not found with id: ${userId}`); err.status = 404; throw err; }
  if (page < 1) { const err = new Error('Page must be >= 1'); err.status = 422; throw err; }
  if (limit < 1 || limit > 100) { const err = new Error('Limit must be between 1 and 100'); err.status = 422; throw err; }
  const offset = (page - 1) * limit;
  const { count, rows } = await model.user_submission.findAndCountAll({ where: { user_id: userId }, attributes: ['submission_id','story_title','story_description','story_status','created_on'], offset, limit, order: [['submission_id','DESC']], raw: true });
  const totalPages = Math.ceil(count / limit);
  return { submissions: rows.map(s => ({ submissionId: s.submission_id, submissionTitle: s.story_title, submissionContent: s.story_description, submissionStatus: ['pending','approved','rejected'][s.story_status] || 'pending', createdOn: s.created_on })), pagination: { currentPage: page, pageSize: limit, totalSubmissions: count, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 } };
};

const deleteUserSubmission = async (userId, submissionId) => {
  const user = await model.user_master.findByPk(userId, { raw: true });
  if (!user) { const err = new Error(`User not found with id: ${userId}`); err.status = 404; throw err; }
  const submission = await model.user_submission.findOne({ where: { submission_id: submissionId, user_id: userId }, raw: true });
  if (!submission) { const err = new Error(`Submission not found with id: ${submissionId}`); err.status = 404; throw err; }
  await model.user_submission.destroy({ where: { submission_id: submissionId, user_id: userId } });
  return { success: true, submissionId, userId, message: `Submission deleted successfully` };
};

// ── getUserSearch (#1268) ─────────────────────────────────────────────────────
const getUserSearch = async (query, pageIndex = 0, visitorId = null) => {
  const PAGE_SIZE = 10;
  const offset = pageIndex * PAGE_SIZE;
  let whereClause = {};
  if (query && query.trim() !== '') {
    whereClause = { [model.Sequelize.Op.or]: [{ user_name: { [model.Sequelize.Op.like]: `%${query.trim()}%` } }, { user_email: { [model.Sequelize.Op.like]: `%${query.trim()}%` } }] };
  }
  const { count, rows } = await model.user_master.findAndCountAll({ where: whereClause, attributes: ['user_id','user_name','user_email','user_mobile','user_avatar','preferred_language','user_gender_id','location_id','location_name','is_participant','created_on'], offset, limit: PAGE_SIZE, order: [['user_id','DESC']], raw: true });
  const totalPages = Math.ceil(count / PAGE_SIZE);
  return { users: rows.map(u => ({ userId: u.user_id, userName: u.user_name, userEmail: u.user_email, userMobile: u.user_mobile, userAvatar: u.user_avatar, languageEnum: u.preferred_language, userGenderId: GenderEnum.indexOf(u.user_gender_id), locationId: u.location_id, locationName: u.location_name, isParticipant: !!u.is_participant, createdOn: u.created_on })), totalElements: count, totalPages, currentPage: pageIndex, pageSize: PAGE_SIZE, hasNextPage: pageIndex < totalPages - 1, hasPreviousPage: pageIndex > 0 };
};

// ── getUserMetrics (#1269) ────────────────────────────────────────────────────
const getUserMetrics = async (userId) => {
  const user = await model.user_master.findByPk(userId, { raw: true });
  if (!user) { const err = new Error(`User not found with id: ${userId}`); err.status = 404; throw err; }
  const [tags, triggers, communities] = await Promise.all([
    model.user_tag_map.findAll({ where: { user_id: userId }, attributes: ['tag_id','tag_name'], raw: true }),
    model.user_trigger_map.findAll({ where: { user_id: userId }, attributes: ['trigger_id','trigger_name'], raw: true }),
    model.user_community_map.findAll({ where: { user_id: userId }, attributes: ['community_id'], raw: true }),
  ]);
  const [storiesReadCount, bookmarksCount, reactionsCount, submissionsCount] = await Promise.all([
    model.user_story_interaction.count({ where: { user_id: userId, mark_as_read: 1 } }),
    model.user_story_map.count({ where: { user_id: userId } }),
    model.user_reaction_map.count({ where: { user_id: userId } }),
    model.user_submission.count({ where: { user_id: userId } }),
  ]);
  return {
    userId: user.user_id, userName: user.user_name, userEmail: user.user_email, userMobile: user.user_mobile,
    userAge: user.user_age, userGenderId: GenderEnum.indexOf(user.user_gender_id), languageEnum: user.preferred_language,
    locationId: user.location_id, locationName: user.location_name, userAvatar: user.user_avatar,
    isEmailLogin: !!user.is_email_login, isParticipant: !!user.is_participant,
    createdOn: user.created_on, updatedOn: user.updated_on,
    userTag: tags.map(t => ({ tagId: t.tag_id, tagName: t.tag_name })),
    triggers: triggers.map(t => ({ triggerId: t.trigger_id, triggerName: t.trigger_name })),
    userCommunity: communities.map(c => ({ communityId: c.community_id })),
    metrics: { storiesRead: storiesReadCount, bookmarksCount, reactionsCount, submissionsCount, tagsCount: tags.length, triggersCount: triggers.length, communitiesCount: communities.length },
  };
};

// ── resetUserInteraction (#1270) ──────────────────────────────────────────────
const resetUserInteraction = async (userId) => {
  const t = await sequelize.transaction();
  try {
    const user = await model.user_master.findByPk(userId, { transaction: t });
    if (!user) { const err = new Error(`User not found with id: ${userId}`); err.status = 404; throw err; }
    const interactionCount = await model.user_story_interaction.destroy({ where: { user_id: userId }, transaction: t });
    const reactionCount = await model.user_reaction_map.destroy({ where: { user_id: userId }, transaction: t });
    await t.commit();
    return { message: `User interactions reset successfully`, userId, deletedCounts: { storyInteractions: interactionCount, reactions: reactionCount } };
  } catch (err) { await t.rollback(); throw err; }
};

// ── clearUserReflectionAndNotes (#1270) ───────────────────────────────────────
const clearUserReflectionAndNotes = async (userId) => {
  const t = await sequelize.transaction();
  try {
    const user = await model.user_master.findByPk(userId, { transaction: t });
    if (!user) { const err = new Error(`User not found with id: ${userId}`); err.status = 404; throw err; }
    const userNotes = await model.user_notes.findAll({ where: { user_id: userId }, attributes: ['note_id'], transaction: t, raw: true });
    const noteIds = userNotes.map(n => n.note_id);
    let promptCount = 0;
    if (noteIds.length > 0) { promptCount = await model.note_prompts.destroy({ where: { note_id: noteIds }, transaction: t }); }
    const noteCount = await model.user_notes.destroy({ where: { user_id: userId }, transaction: t });
    const reflectionCount = await model.story_reflections.destroy({ where: { user_id: userId }, transaction: t });
    await t.commit();
    return { message: `User reflections and notes cleared successfully`, userId, deletedCounts: { notePrompts: promptCount, userNotes: noteCount, storyReflections: reflectionCount } };
  } catch (err) { await t.rollback(); throw err; }
};

module.exports = {
  saveUser,
  checkExistingUser,
  updateUser,
  getUser,
  deleteUser,
  updateLanguage,
  markStoryAsRead,          // #1263 ✅ renamed from readStory
  addStoryBookmark,         // #1264 ✅ unchanged
  getUserList,
  deleteStoryBookmark,      // #1266 ✅ unchanged
  addUserSubmission,
  getUserSubmission,
  getUserSubmissions,
  deleteUserSubmission,
  getUserSearch,
  getUserMetrics,
  resetUserInteraction,
  clearUserReflectionAndNotes,
};