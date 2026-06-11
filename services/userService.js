'use strict';

const model = require('../models/index');
const { sequelize } = model;
const jwt = require('jsonwebtoken');
const { config } = require('../config/nodeConfig');

// ─── Enums (mirroring Java) ───────────────────────────────────────────────────
const GenderEnum = ['OTHER', 'MALE', 'FEMALE', 'TRANSGENDER', 'NON_BINARY', 'PREFER_NOT_TO_SAY'];
const LanguageEnum = ['ENGLISH', 'HINDI'];

/**
 * Generate JWT token matching Java JwtUtil.generateToken() claims exactly.
 * Claims: user_id, email_id, user_name, mobile_number, preferred_language, user_avatar
 */
const generateUserToken = (user) => {
  return jwt.sign(
    {
      user_id: user.user_id,
      email_id: user.user_email,
      user_name: user.user_name,
      mobile_number: user.user_mobile,
      preferred_language: user.preferred_language, // ordinal: 0=ENGLISH, 1=HINDI
      user_avatar: user.user_avatar,
    },
    config().JWT_KEY,
    { expiresIn: '7d' }
  );
};

/**
 * Save / Register a new user.
 * Mirrors: UserServiceImpl.saveUser()
 *
 * Validation rules (from Java validateUserEntity / validateEmail / validateMobile):
 *  isEmailLogin=true  → email must be unique (email+isEmailLogin=true),
 *                       mobile must be globally unique if provided,
 *                       email must not exist for mobile-login users either
 *  isEmailLogin=false → mobile must be globally unique (mobile+isEmailLogin=false),
 *                       mobile must not exist for email-login users,
 *                       email (if provided) must be globally unique
 */
const saveUser = async (userData) => {
  const t = await sequelize.transaction();

  try {
    const {
      userName,
      userAge,
      userMobile,
      userGenderId,
      languageEnum,
      locationId,
      locationName,
      userEmail,
      userAvatar,
      triggers = [],
      userTag = [],
      userCommunity = [],
      isEmailLogin = true,
    } = userData;

    // ── Duplicate-check logic (Java: validateEmail / validateMobile) ──────────
    if (isEmailLogin) {
      // email cannot be null
      if (!userEmail) {
        const err = new Error('User Email cannot be null');
        err.status = 400;
        throw err;
      }

      // email must not exist for email-login users
      const emailLoginCount = await model.user_master.count({
        where: { user_email: userEmail, is_email_login: true },
        transaction: t,
      });
      if (emailLoginCount > 0) {
        const err = new Error(`User already exists with email Id: ${userEmail}`);
        err.status = 409;
        throw err;
      }

      // if mobile provided, must be globally unique
      if (userMobile) {
        const mobileCount = await model.user_master.count({
          where: { user_mobile: userMobile },
          transaction: t,
        });
        if (mobileCount > 0) {
          const err = new Error(`User already exists with mobile: ${userMobile}`);
          err.status = 409;
          throw err;
        }
      }

      // email must not exist even for mobile-login users
      const emailMobileCount = await model.user_master.count({
        where: { user_email: userEmail },
        transaction: t,
      });
      if (emailMobileCount > 0) {
        const err = new Error(`User already exists with email Id: ${userEmail}`);
        err.status = 409;
        throw err;
      }

    } else {
      // mobile-login: mobile must not exist for mobile-login users
      const mobileLoginCount = await model.user_master.count({
        where: { user_mobile: userMobile, is_email_login: false },
        transaction: t,
      });
      if (mobileLoginCount > 0) {
        const err = new Error(`User already exists with mobile: ${userMobile}`);
        err.status = 409;
        throw err;
      }

      // mobile must be globally unique (no email-login user with same mobile)
      const mobileGlobalCount = await model.user_master.count({
        where: { user_mobile: userMobile },
        transaction: t,
      });
      if (mobileGlobalCount > 0) {
        const err = new Error(`User already exists with mobile: ${userMobile}`);
        err.status = 409;
        throw err;
      }

      // email (if provided and non-empty) must be globally unique
      if (userEmail && userEmail.trim() !== '') {
        const emailCount = await model.user_master.count({
          where: { user_email: userEmail },
          transaction: t,
        });
        if (emailCount > 0) {
          const err = new Error(`User already exists with email Id: ${userEmail}`);
          err.status = 409;
          throw err;
        }
      }
    }

    // ── Resolve gender string for DB ENUM ────────────────────────────────────
    // Java sends enum ordinal (int) or name (string); DB stores as ENUM string
    let genderDbValue;
    if (typeof userGenderId === 'number') {
      genderDbValue = GenderEnum[userGenderId] || 'OTHER';
    } else {
      genderDbValue = String(userGenderId).toUpperCase();
    }

    // ── Resolve language ordinal for DB TINYINT ───────────────────────────────
    let languageOrdinal;
    if (typeof languageEnum === 'number') {
      languageOrdinal = languageEnum;
    } else {
      languageOrdinal = LanguageEnum.indexOf(String(languageEnum).toUpperCase());
      if (languageOrdinal < 0) languageOrdinal = 0; // default ENGLISH
    }

    // ── Create user (Java: isParticipant set to false) ────────────────────────
    const savedUser = await model.user_master.create(
      {
        user_name: userName,
        user_age: userAge,
        user_mobile: userMobile || null,
        user_gender_id: genderDbValue,
        preferred_language: languageOrdinal,
        location_id: locationId,
        location_name: locationName,
        user_email: userEmail,
        user_avatar: userAvatar || null,
        is_email_login: isEmailLogin,
        is_participant: false,
        created_on: new Date(),
        updated_on: new Date(),
      },
      { transaction: t }
    );

    // ── Process tags (Java: processUserTags / saveUserTags) ───────────────────
    const savedTags = [];
    for (const tag of userTag) {
      const tagRecord = await model.tag_master.findByPk(tag.tagId, { transaction: t });
      if (!tagRecord) {
        const err = new Error(`Tag not found with id: ${tag.tagId}`);
        err.status = 404;
        throw err;
      }
      const savedTag = await model.user_tag_map.create(
        {
          tag_id: tag.tagId,
          tag_name: tagRecord.tag_desc,
          user_id: savedUser.user_id,
        },
        { transaction: t }
      );
      savedTags.push(savedTag.get({ plain: true }));
    }

    // ── Process triggers (Java: processUserTriggers / saveUserTriggers) ───────
    const savedTriggers = [];
    for (const trigger of triggers) {
      const triggerRecord = await model.trigger_master.findByPk(trigger.triggerId, { transaction: t });
      if (!triggerRecord) {
        const err = new Error(`Trigger not found with id: ${trigger.triggerId}`);
        err.status = 404;
        throw err;
      }
      const savedTrigger = await model.user_trigger_map.create(
        {
          trigger_id: trigger.triggerId,
          trigger_name: triggerRecord.trigger_desc,
          user_id: savedUser.user_id,
        },
        { transaction: t }
      );
      savedTriggers.push(savedTrigger.get({ plain: true }));
    }

    // ── Process communities (Java: processUserCommunities) ────────────────────
    const savedCommunities = [];
    for (const community of userCommunity) {
      // community_id can be ordinal int or enum string name
      let communityOrdinal;
      if (typeof community.communityId === 'number') {
        communityOrdinal = community.communityId;
      } else {
        const CommunityEnum = [
          'OTHER', 'LGBTQIA', 'PERSON_WITH_DISABILITY',
          'DALIT_BAHUJAN_OR_ADIVASI', 'RELIGIOUS_MINORITIES', 'NOT_APPLICABLE',
        ];
        communityOrdinal = CommunityEnum.indexOf(String(community.communityId).toUpperCase());
        if (communityOrdinal < 0) communityOrdinal = 0;
      }
      const savedCommunity = await model.user_community_map.create(
        {
          community_id: communityOrdinal,
          user_id: savedUser.user_id,
        },
        { transaction: t }
      );
      savedCommunities.push(savedCommunity.get({ plain: true }));
    }

    await t.commit();

    // ── Build UserResponseDto (mirrors Java buildUserResponseDto) ─────────────
    const token = generateUserToken(savedUser);

    return {
      userId: savedUser.user_id,
      userName: savedUser.user_name,
      userAge: savedUser.user_age,
      userMobile: savedUser.user_mobile,
      userGenderId: GenderEnum.indexOf(savedUser.user_gender_id), // ordinal
      languageEnum: savedUser.preferred_language,                  // ordinal
      locationId: savedUser.location_id,
      locationName: savedUser.location_name,
      userEmail: savedUser.user_email,
      userAvatar: savedUser.user_avatar,
      triggers: savedTriggers,
      userTag: savedTags,
      userCommunity: savedCommunities,
      userSubmissions: [],
      jwtToken: token,
      isEmailLogin: savedUser.is_email_login,
    };

  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// exports moved to bottom

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1257 — Login
// Mirrors: UserServiceImpl.checkExistingUser()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if user exists by email OR mobile and return JWT.
 * Java: UserServiceImpl.checkExistingUser(UserLoginRequestDto, HttpServletResponse)
 *
 * Logic:
 *  - if userEmail provided → findByUserEmail()
 *  - else               → findByUserMobile()
 *  - if found  → userExists="TRUE", return userId + jwtToken + isEmailLogin
 *  - if not found → userExists="FALSE" (no error thrown — Java returns 200)
 *
 * Cookie-setting is handled in the controller (mirrors CookieManager behaviour).
 */
const checkExistingUser = async (userEmail, userMobile) => {
  let user = null;

  if (userEmail) {
    user = await model.user_master.findOne({
      where: { user_email: userEmail },
      raw: true,
    });
    // Java: also persist isEmailLogin flag on the found record
    if (user) {
      await model.user_master.update(
        { is_email_login: user.is_email_login }, // preserves existing value
        { where: { user_id: user.user_id } }
      );
    }
  } else {
    user = await model.user_master.findOne({
      where: { user_mobile: userMobile },
      raw: true,
    });
    if (user) {
      await model.user_master.update(
        { is_email_login: user.is_email_login },
        { where: { user_id: user.user_id } }
      );
    }
  }

  if (!user) {
    return { userExists: 'FALSE', userId: null, jwtToken: null, isEmailLogin: null };
  }

  const token = generateUserToken(user);

  return {
    userExists: 'TRUE',
    userId: user.user_id,
    jwtToken: token,
    isEmailLogin: !!user.is_email_login,
  };
};

// exports at bottom

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1259 — Update User
// Mirrors: UserServiceImpl.updateUser()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update existing user profile.
 * Java: UserServiceImpl.updateUser(UserEntity, int id, String token)
 *
 * Logic:
 *  - Find user by id (404 if not found)
 *  - Update basic info (name, age, avatar, gender, language, location)
 *  - if !isEmailLogin → update email (mobile-login users can change email)
 *  - if isEmailLogin  → update mobile
 *  - Delete + re-save communities, tags, triggers
 *  - Duplicate check for email/mobile on update (409 if clash)
 */
const updateUser = async (userId, userData) => {
  const t = await sequelize.transaction();
  try {
    const existing = await model.user_master.findByPk(userId, { transaction: t });
    if (!existing) {
      const err = new Error(`User not found with id: ${userId}`);
      err.status = 404;
      throw err;
    }

    const {
      userName, userAge, userAvatar, userGenderId, languageEnum,
      locationId, locationName, userEmail, userMobile,
      userTag = [], triggers = [], userCommunity = [],
    } = userData;

    // Resolve gender
    let genderDbValue;
    if (typeof userGenderId === 'number') {
      genderDbValue = GenderEnum[userGenderId] || existing.user_gender_id;
    } else {
      genderDbValue = String(userGenderId).toUpperCase();
    }

    // Resolve language
    let languageOrdinal;
    if (typeof languageEnum === 'number') {
      languageOrdinal = languageEnum;
    } else {
      languageOrdinal = LanguageEnum.indexOf(String(languageEnum).toUpperCase());
      if (languageOrdinal < 0) languageOrdinal = existing.preferred_language;
    }

    // Build update fields
    const updateFields = {
      user_name:          userName      !== undefined ? userName      : existing.user_name,
      user_age:           userAge       !== undefined ? userAge       : existing.user_age,
      user_avatar:        userAvatar    !== undefined ? userAvatar    : existing.user_avatar,
      user_gender_id:     genderDbValue,
      preferred_language: languageOrdinal,
      location_id:        locationId    !== undefined ? locationId    : existing.location_id,
      location_name:      locationName  !== undefined ? locationName  : existing.location_name,
      updated_on:         new Date(),
    };

    // Java: if !isEmailLogin → update email; if isEmailLogin → update mobile
    if (!existing.is_email_login) {
      if (userEmail !== undefined && userEmail !== existing.user_email) {
        // Check duplicate email globally
        const dup = await model.user_master.count({
          where: { user_email: userEmail },
          transaction: t,
        });
        if (dup > 0) {
          const err = new Error(`User already exists with email Id: ${userEmail}`);
          err.status = 409;
          throw err;
        }
        updateFields.user_email = userEmail;
      }
    } else {
      if (userMobile !== undefined && userMobile !== existing.user_mobile) {
        // Check duplicate mobile globally
        const dup = await model.user_master.count({
          where: { user_mobile: userMobile },
          transaction: t,
        });
        if (dup > 0) {
          const err = new Error(`User already exists with mobile: ${userMobile}`);
          err.status = 409;
          throw err;
        }
        updateFields.user_mobile = userMobile;
      }
    }

    await model.user_master.update(updateFields, {
      where: { user_id: userId },
      transaction: t,
    });

    // ── Communities: delete + re-save ─────────────────────────────────────
    await model.user_community_map.destroy({ where: { user_id: userId }, transaction: t });
    for (const c of userCommunity) {
      let ordinal = typeof c.communityId === 'number' ? c.communityId
        : ['OTHER','LGBTQIA','PERSON_WITH_DISABILITY','DALIT_BAHUJAN_OR_ADIVASI','RELIGIOUS_MINORITIES','NOT_APPLICABLE'].indexOf(String(c.communityId).toUpperCase());
      if (ordinal < 0) ordinal = 0;
      await model.user_community_map.create({ community_id: ordinal, user_id: userId }, { transaction: t });
    }

    // ── Tags: delete + re-save ─────────────────────────────────────────────
    await model.user_tag_map.destroy({ where: { user_id: userId }, transaction: t });
    for (const tag of userTag) {
      const tagRecord = await model.tag_master.findByPk(tag.tagId, { transaction: t });
      if (!tagRecord) {
        const err = new Error(`Tag not found with id: ${tag.tagId}`);
        err.status = 404;
        throw err;
      }
      await model.user_tag_map.create({ tag_id: tag.tagId, tag_name: tagRecord.tag_desc, user_id: userId }, { transaction: t });
    }

    // ── Triggers: delete + re-save ─────────────────────────────────────────
    await model.user_trigger_map.destroy({ where: { user_id: userId }, transaction: t });
    for (const trig of triggers) {
      const trigRecord = await model.trigger_master.findByPk(trig.triggerId, { transaction: t });
      if (!trigRecord) {
        const err = new Error(`Trigger not found with id: ${trig.triggerId}`);
        err.status = 404;
        throw err;
      }
      await model.user_trigger_map.create({ trigger_id: trig.triggerId, trigger_name: trigRecord.trigger_desc, user_id: userId }, { transaction: t });
    }

    await t.commit();

    // Return updated user entity (Java returns UserEntity directly)
    const updated = await model.user_master.findByPk(userId, { raw: true });
    return updated;

  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1260 — Get User
// Mirrors: UserServiceImpl.getUser()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieve user profile by ID with all relationships (tags, triggers, communities).
 * Returns complete UserResponseDto matching Java response.
 */
const getUser = async (userId) => {
  const user = await model.user_master.findByPk(userId, { raw: true });
  if (!user) {
    const err = new Error(`User not found with id: ${userId}`);
    err.status = 404;
    throw err;
  }

  const tags = await model.user_tag_map.findAll({
    where: { user_id: userId },
    attributes: ['tag_id'],
    raw: true,
  });

  const triggers = await model.user_trigger_map.findAll({
    where: { user_id: userId },
    attributes: ['trigger_id'],
    raw: true,
  });

  const communities = await model.user_community_map.findAll({
    where: { user_id: userId },
    attributes: ['community_id'],
    raw: true,
  });

  return {
    userId: user.user_id,
    userName: user.user_name,
    userAge: user.user_age,
    userMobile: user.user_mobile,
    userGenderId: GenderEnum.indexOf(user.user_gender_id),
    languageEnum: user.preferred_language,
    locationId: user.location_id,
    locationName: user.location_name,
    userEmail: user.user_email,
    userAvatar: user.user_avatar,
    isEmailLogin: !!user.is_email_login,
    isParticipant: user.is_participant,
    userTag: tags.map(t => ({ tagId: t.tag_id })),
    triggers: triggers.map(t => ({ triggerId: t.trigger_id })),
    userCommunity: communities.map(c => ({ communityId: c.community_id })),
    createdOn: user.created_on,
    updatedOn: user.updated_on,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1261 — Delete User
// Mirrors: UserServiceImpl.deleteUser()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Soft delete user and all relationships.
 * Deletes from: user_master, user_tag_map, user_trigger_map, user_community_map
 */
const deleteUser = async (userId) => {
  const t = await sequelize.transaction();
  try {
    const user = await model.user_master.findByPk(userId, { transaction: t });
    if (!user) {
      const err = new Error(`User not found with id: ${userId}`);
      err.status = 404;
      throw err;
    }

    await model.user_community_map.destroy({ where: { user_id: userId }, transaction: t });
    await model.user_tag_map.destroy({ where: { user_id: userId }, transaction: t });
    await model.user_trigger_map.destroy({ where: { user_id: userId }, transaction: t });
    await model.user_master.destroy({ where: { user_id: userId }, transaction: t });

    await t.commit();

    return { success: true, message: `User deleted successfully`, userId };
  } catch (err) {
    await t.rollback();
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1262 — Update Language for User
// Mirrors: UserServiceImpl.updateLanguage()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update user's preferred language.
 * LanguageEnum: 0=ENGLISH, 1=HINDI
 */
const updateLanguage = async (userId, languageEnum) => {
  const user = await model.user_master.findByPk(userId, { raw: true });
  if (!user) {
    const err = new Error(`User not found with id: ${userId}`);
    err.status = 404;
    throw err;
  }

  if (typeof languageEnum !== 'number' || languageEnum < 0 || languageEnum > 1) {
    const err = new Error(`Invalid languageEnum. Must be 0 (ENGLISH) or 1 (HINDI)`);
    err.status = 400;
    throw err;
  }

  await model.user_master.update(
    { preferred_language: languageEnum, updated_on: new Date() },
    { where: { user_id: userId } }
  );

  const updated = await model.user_master.findByPk(userId, { raw: true });

  return {
    userId: updated.user_id,
    userName: updated.user_name,
    languageEnum: updated.preferred_language,
    message: `Language updated to ${languageEnum === 0 ? 'ENGLISH' : 'HINDI'}`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1263 — Read Story
// Mirrors: StoryServiceImpl.getStory() / readStory()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieve story by ID.
 * Returns complete story details with metadata.
 */
const readStory = async (userId, storyId) => {
  const story = await model.story_master.findOne({
    where: { id: storyId },
    raw: true,
  });

  if (!story) {
    const err = new Error(`Story not found with id: ${storyId}`);
    err.status = 404;
    throw err;
  }

  const tags = await model.story_tag_map.findAll({
    where: { id: storyId },
    attributes: ['tag_id'],
    raw: true,
  });

  const bookmarks = await model.story_bookmark_map.count({
    where: { id: storyId },
  });

  return {
    storyId: story.id,
    userId: story.user_id,
    storyTitle: story.story_title,
    storyDescription: story.story_description,
    storyContent: story.story_content,
    storyStatus: story.story_status,
    storyViews: story.story_views || 0,
    storyLikes: story.story_likes || 0,
    storyBookmarks: bookmarks,
    isOwnStory: story.user_id === userId,
    createdOn: story.created_on,
    updatedOn: story.updated_on,
    tags: tags.map(t => ({ tagId: t.tag_id })),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1264 — Add Story Bookmark
// Mirrors: BookmarkServiceImpl.addBookmark()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add/create bookmark for a story.
 * Saves story to user's bookmarks list.
 */
const addStoryBookmark = async (userId, storyId) => {
  const user = await model.user_master.findByPk(userId, { raw: true });
  if (!user) {
    const err = new Error(`User not found with id: ${userId}`);
    err.status = 404;
    throw err;
  }

  const story = await model.story_master.findByPk(storyId, { raw: true });
  if (!story) {
    const err = new Error(`Story not found with id: ${storyId}`);
    err.status = 404;
    throw err;
  }

  const existing = await model.story_bookmark_map.findOne({
    where: { user_id: userId, story_id: storyId },
    raw: true,
  });

  if (existing) {
    const err = new Error(`Story already bookmarked by this user`);
    err.status = 409;
    throw err;
  }

  const bookmark = await model.story_bookmark_map.create({
    user_id: userId,
    story_id: storyId,
    bookmarked_on: new Date(),
  });

  return {
    success: true,
    bookmarkId: bookmark.id,
    userId: userId,
    storyId: storyId,
    bookmarkedOn: bookmark.bookmarked_on,
    message: `Story bookmarked successfully`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1265 — Get User List
// Mirrors: UserServiceImpl.getUserList() / getAllUsers()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieve paginated list of all users.
 * Supports pagination and filtering.
 */
const getUserList = async (page = 1, limit = 10, searchTerm = null) => {
  const offset = (page - 1) * limit;

  let whereClause = {};
  if (searchTerm) {
    whereClause = {
      [model.Sequelize.Op.or]: [
        { user_name: { [model.Sequelize.Op.like]: `%${searchTerm}%` } },
        { user_email: { [model.Sequelize.Op.like]: `%${searchTerm}%` } },
      ],
    };
  }

  const { count, rows } = await model.user_master.findAndCountAll({
    where: whereClause,
    attributes: ['user_id', 'user_name', 'user_email', 'user_mobile', 'user_avatar', 'preferred_language', 'created_on'],
    offset: offset,
    limit: limit,
    order: [['user_id', 'DESC']],
    raw: true,
  });

  const totalPages = Math.ceil(count / limit);

  return {
    users: rows.map(user => ({
      userId: user.user_id,
      userName: user.user_name,
      userEmail: user.user_email,
      userMobile: user.user_mobile,
      userAvatar: user.user_avatar,
      languageEnum: user.preferred_language,
      createdOn: user.created_on,
    })),
    pagination: {
      currentPage: page,
      pageSize: limit,
      totalUsers: count,
      totalPages: totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};

module.exports = { saveUser, generateUserToken, checkExistingUser, updateUser, getUser, deleteUser, updateLanguage, readStory, addStoryBookmark ,getUserList };
