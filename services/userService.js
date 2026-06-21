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
      preferred_language: user.preferred_language,
      user_avatar: user.user_avatar,
    },
    config().JWT_KEY,
    { expiresIn: '7d' }
  );
};

/**
 * Save / Register a new user.
 * Mirrors: UserServiceImpl.saveUser()
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

    // ── Duplicate-check logic ──────────────────────────────────────────────
    if (isEmailLogin) {
      if (!userEmail) {
        const err = new Error('User Email cannot be null');
        err.status = 400;
        throw err;
      }

      const emailLoginCount = await model.user_master.count({
        where: { user_email: userEmail, is_email_login: true },
        transaction: t,
      });
      if (emailLoginCount > 0) {
        const err = new Error(`User already exists with email Id: ${userEmail}`);
        err.status = 409;
        throw err;
      }

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
      const mobileLoginCount = await model.user_master.count({
        where: { user_mobile: userMobile, is_email_login: false },
        transaction: t,
      });
      if (mobileLoginCount > 0) {
        const err = new Error(`User already exists with mobile: ${userMobile}`);
        err.status = 409;
        throw err;
      }

      const mobileGlobalCount = await model.user_master.count({
        where: { user_mobile: userMobile },
        transaction: t,
      });
      if (mobileGlobalCount > 0) {
        const err = new Error(`User already exists with mobile: ${userMobile}`);
        err.status = 409;
        throw err;
      }

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

    // ── Resolve gender string for DB ENUM ──────────────────────────────────
    let genderDbValue;
    if (typeof userGenderId === 'number') {
      genderDbValue = GenderEnum[userGenderId] || 'OTHER';
    } else {
      genderDbValue = String(userGenderId).toUpperCase();
    }

    // ── Resolve language ordinal for DB TINYINT ────────────────────────────
    let languageOrdinal;
    if (typeof languageEnum === 'number') {
      languageOrdinal = languageEnum;
    } else {
      languageOrdinal = LanguageEnum.indexOf(String(languageEnum).toUpperCase());
      if (languageOrdinal < 0) languageOrdinal = 0;
    }

    // ── Create user ────────────────────────────────────────────────────────
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

    // ── Process tags ───────────────────────────────────────────────────────
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

    // ── Process triggers ───────────────────────────────────────────────────
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

    // ── Process communities ────────────────────────────────────────────────
    const savedCommunities = [];
    for (const community of userCommunity) {
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

    // ── Build UserResponseDto ──────────────────────────────────────────────
    const token = generateUserToken(savedUser);

    return {
      userId: savedUser.user_id,
      userName: savedUser.user_name,
      userAge: savedUser.user_age,
      userMobile: savedUser.user_mobile,
      userGenderId: GenderEnum.indexOf(savedUser.user_gender_id),
      languageEnum: savedUser.preferred_language,
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

/**
 * Check if user exists by email OR mobile and return JWT.
 * Mirrors: UserServiceImpl.checkExistingUser()
 */
const checkExistingUser = async (userEmail, userMobile) => {
  let user = null;

  if (userEmail) {
    user = await model.user_master.findOne({
      where: { user_email: userEmail },
      raw: true,
    });
    if (user) {
      await model.user_master.update(
        { is_email_login: user.is_email_login },
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

/**
 * Update existing user profile.
 * Mirrors: UserServiceImpl.updateUser()
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

    let genderDbValue;
    if (typeof userGenderId === 'number') {
      genderDbValue = GenderEnum[userGenderId] || existing.user_gender_id;
    } else {
      genderDbValue = String(userGenderId).toUpperCase();
    }

    let languageOrdinal;
    if (typeof languageEnum === 'number') {
      languageOrdinal = languageEnum;
    } else {
      languageOrdinal = LanguageEnum.indexOf(String(languageEnum).toUpperCase());
      if (languageOrdinal < 0) languageOrdinal = existing.preferred_language;
    }

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

    if (!existing.is_email_login) {
      if (userEmail !== undefined && userEmail !== existing.user_email) {
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

    await model.user_community_map.destroy({ where: { user_id: userId }, transaction: t });
    for (const c of userCommunity) {
      let ordinal = typeof c.communityId === 'number' ? c.communityId
        : ['OTHER','LGBTQIA','PERSON_WITH_DISABILITY','DALIT_BAHUJAN_OR_ADIVASI','RELIGIOUS_MINORITIES','NOT_APPLICABLE'].indexOf(String(c.communityId).toUpperCase());
      if (ordinal < 0) ordinal = 0;
      await model.user_community_map.create({ community_id: ordinal, user_id: userId }, { transaction: t });
    }

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

    const updated = await model.user_master.findByPk(userId, { raw: true });
    return updated;

  } catch (err) {
    await t.rollback();
    throw err;
  }
};

/**
 * Retrieve user profile by ID with all relationships.
 * Mirrors: UserServiceImpl.getUser()
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

/**
 * Delete user and all relationships.
 * Mirrors: UserServiceImpl.deleteUser()
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

/**
 * Update user's preferred language.
 * Mirrors: UserServiceImpl.updateLanguage()
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

/**
 * Retrieve story by ID.
 * Mirrors: StoryServiceImpl.getStory()
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
  
  if (userId) {
    const interaction =
      await model.user_story_interaction.findOne({
        where: {
          user_id: userId,
          story_id: storyId,
        },
      });

    if (interaction) {
      await interaction.update({
        mark_as_read: 1,
        updated_on: new Date(),
      });
    } else {
      await model.user_story_interaction.create({
        user_id: userId,
        story_id: storyId,
        mark_as_read: 1,
        updated_on: new Date(),
      });
    }
  }


  const tags = await model.story_tag_map.findAll({
    where: { story_id: storyId },
    attributes: ['tag_id'],
    raw: true,
  });

  return {
    storyId: story.id,
    userId: story.user_id,
    storyTitle: story.title,
    storyDescription: story.story_desc,
    storyContent: story.story_background_card_uri,
    storyStatus: story.story_status,
    storyViews: 0,
    storyLikes: 0,
    storyBookmarks: 0,
    isOwnStory: story.user_id === userId,
    createdOn: story.created_on,
    updatedOn: story.updated_on,
    tags: tags.map(t => ({ tagId: t.tag_id })),
  };
};

/**
 * Add bookmark for a story.
 * Mirrors: BookmarkServiceImpl.addBookmark()
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

  const existing = await model.user_story_map.findOne({
    where: { user_id: userId, story_id: storyId },
    raw: true,
  });

  if (existing) {
    const err = new Error(`Story already bookmarked by this user`);
    err.status = 409;
    throw err;
  }

  const bookmark = await model.user_story_map.create({
    user_id: userId,
    story_id: storyId,
  });

  return {
    success: true,
    bookmarkId: bookmark.id,
    userId: userId,
    storyId: storyId,
    bookmarkedOn: new Date(),
    message: `Story bookmarked successfully`,
  };
};

/**
 * Get paginated list of all users.
 * Mirrors: UserServiceImpl.getUserList()
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

/**
 * Delete/remove bookmark for a story.
 * Mirrors: BookmarkServiceImpl.removeBookmark()
 */
const deleteStoryBookmark = async (userId, storyId) => {
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

  const bookmark = await model.user_story_map.findOne({
    where: { user_id: userId, story_id: storyId },
    raw: true,
  });

  if (!bookmark) {
    const err = new Error(`Bookmark not found for this user and story`);
    err.status = 404;
    throw err;
  }

  await model.user_story_map.destroy({
    where: { user_id: userId, story_id: storyId },
  });

  return {
    success: true,
    userId: userId,
    storyId: storyId,
    message: `Story bookmark removed successfully`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// ✅ FIXED: Issue #1267 — User Submissions (Add, Get, Delete)
// ✅ Key Fix: Use correct database column names (story_title, story_description, story_status)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create/Add a new user submission.
 * ✅ FIXED: Maps incoming camelCase to database snake_case columns
 *   - submissionTitle → story_title
 *   - submissionContent → story_description
 *   - submissionStatus → story_status (0=pending, 1=approved, 2=rejected)
 */
const addUserSubmission = async (userId, submissionData) => {
  const user = await model.user_master.findByPk(userId, { raw: true });
  if (!user) {
    const err = new Error(`User not found with id: ${userId}`);
    err.status = 404;
    throw err;
  }

  if (!submissionData.submissionTitle || submissionData.submissionTitle.trim() === '') {
    const err = new Error(`Submission title is required`);
    err.status = 400;
    throw err;
  }

  if (!submissionData.submissionContent || submissionData.submissionContent.trim() === '') {
    const err = new Error(`Submission content is required`);
    err.status = 400;
    throw err;
  }

  // Convert status string to ordinal (0=pending, 1=approved, 2=rejected)
  let statusOrdinal = 0; // default: pending
  if (submissionData.submissionStatus) {
    const statusMap = { pending: 0, approved: 1, rejected: 2 };
    statusOrdinal = typeof submissionData.submissionStatus === 'string'
      ? (statusMap[submissionData.submissionStatus] || 0)
      : submissionData.submissionStatus;
  }

  const submission = await model.user_submission.create({
    user_id: userId,
    story_title: submissionData.submissionTitle,           // ✅ FIXED: Map to story_title
    story_description: submissionData.submissionContent,   // ✅ FIXED: Map to story_description
    story_status: statusOrdinal,                           // ✅ FIXED: Map to story_status
    created_on: new Date(),
    updated_on: new Date(),
  });

  return {
    submissionId: submission.submission_id,
    userId: submission.user_id,
    submissionTitle: submission.story_title,              // ✅ FIXED: Map back to camelCase
    submissionContent: submission.story_description,      // ✅ FIXED: Map back to camelCase
    submissionStatus: ['pending', 'approved', 'rejected'][submission.story_status] || 'pending',
    createdOn: submission.created_on,
    message: `Submission created successfully`,
  };
};

/**
 * Retrieve a single submission by ID.
 */
const getUserSubmission = async (userId, submissionId) => {
  const user = await model.user_master.findByPk(userId, { raw: true });
  if (!user) {
    const err = new Error(`User not found with id: ${userId}`);
    err.status = 404;
    throw err;
  }

  const submission = await model.user_submission.findOne({
    where: { submission_id: submissionId, user_id: userId },
    raw: true,
  });

  if (!submission) {
    const err = new Error(`Submission not found with id: ${submissionId}`);
    err.status = 404;
    throw err;
  }

  return {
    submissionId: submission.submission_id,
    userId: submission.user_id,
    submissionTitle: submission.story_title,
    submissionContent: submission.story_description,
    submissionStatus: ['pending', 'approved', 'rejected'][submission.story_status] || 'pending',
    createdOn: submission.created_on,
    updatedOn: submission.updated_on,
  };
};

/**
 * Get all submissions for a user (paginated).
 * ✅ CRITICAL FIX: Use correct database column names in query
 *    - attributes: ['submission_id', 'story_title', 'story_description', 'story_status', ...]
 *    - NOT: ['submission_id', 'submissionTitle', 'submissionContent', ...]
 */
const getUserSubmissions = async (userId, page = 1, limit = 10) => {
  const user = await model.user_master.findByPk(userId, { raw: true });
  if (!user) {
    const err = new Error(`User not found with id: ${userId}`);
    err.status = 404;
    throw err;
  }

  // ✅ Validate pagination before querying
  if (page < 1) {
    const err = new Error('Page must be >= 1');
    err.status = 422;
    throw err;
  }
  if (limit < 1 || limit > 100) {
    const err = new Error('Limit must be between 1 and 100');
    err.status = 422;
    throw err;
  }

  const offset = (page - 1) * limit;

  // ✅ CRITICAL FIX: Use actual database columns (story_title, story_description, story_status)
  // This prevents: "Unknown column 'submissionTitle' in 'field list'"
  const { count, rows } = await model.user_submission.findAndCountAll({
    where: { user_id: userId },
    attributes: ['submission_id', 'story_title', 'story_description', 'story_status', 'created_on'],
    offset: offset,
    limit: limit,
    order: [['submission_id', 'DESC']],
    raw: true,
  });

  const totalPages = Math.ceil(count / limit);

  return {
    submissions: rows.map(sub => ({
      submissionId: sub.submission_id,
      submissionTitle: sub.story_title,           // Map from snake_case
      submissionContent: sub.story_description,   // Map from snake_case
      submissionStatus: ['pending', 'approved', 'rejected'][sub.story_status] || 'pending',
      createdOn: sub.created_on,
    })),
    pagination: {
      currentPage: page,
      pageSize: limit,
      totalSubmissions: count,
      totalPages: totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};

/**
 * Delete a user submission.
 */
const deleteUserSubmission = async (userId, submissionId) => {
  const user = await model.user_master.findByPk(userId, { raw: true });
  if (!user) {
    const err = new Error(`User not found with id: ${userId}`);
    err.status = 404;
    throw err;
  }

  const submission = await model.user_submission.findOne({
    where: { submission_id: submissionId, user_id: userId },
    raw: true,
  });

  if (!submission) {
    const err = new Error(`Submission not found with id: ${submissionId}`);
    err.status = 404;
    throw err;
  }

  await model.user_submission.destroy({
    where: { submission_id: submissionId, user_id: userId },
  });

  return {
    success: true,
    submissionId: submissionId,
    userId: userId,
    message: `Submission deleted successfully`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1268 — Get User Search
// Mirrors: UserServiceImpl.getUserSearch() / UserRepository searchUsers LIKE query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search users by name or email with 0-based page-index pagination.
 *
 * Java contract (from UserController.getUserSearch):
 *   GET /users/search?query=<string>&pageIndex=<int>&visitorId=<optional>
 *   - pageIndex is 0-based (Java Spring Page<T>); page size is fixed at 10.
 *   - Authentication is optional (public path in Java Spring Security allowlist).
 *   - Searches user_name and user_email with LIKE %query%.
 *   - Returns account details / search result object.
 *
 * Database tables used:
 *   - user_master (primary search target)
 *
 * @param {string}  query      - Search term (user name or email fragment)
 * @param {number}  pageIndex  - 0-based page index (default 0)
 * @param {string}  visitorId  - Optional visitor UUID (passed through, not used in DB query)
 * @returns {Object} Search result payload
 */
const getUserSearch = async (query, pageIndex = 0, visitorId = null) => {
  // Fixed page size matching Java PageRequest.of(pageIndex, 10)
  const PAGE_SIZE = 10;
  const offset = pageIndex * PAGE_SIZE;

  // Build LIKE filter — empty/blank query returns all users (mirrors Java behaviour)
  let whereClause = {};
  if (query && query.trim() !== '') {
    whereClause = {
      [model.Sequelize.Op.or]: [
        { user_name:  { [model.Sequelize.Op.like]: `%${query.trim()}%` } },
        { user_email: { [model.Sequelize.Op.like]: `%${query.trim()}%` } },
      ],
    };
  }

  const { count, rows } = await model.user_master.findAndCountAll({
    where: whereClause,
    attributes: [
      'user_id', 'user_name', 'user_email', 'user_mobile',
      'user_avatar', 'preferred_language', 'user_gender_id',
      'location_id', 'location_name', 'is_participant', 'created_on',
    ],
    offset,
    limit: PAGE_SIZE,
    order: [['user_id', 'DESC']],
    raw: true,
  });

  const totalPages = Math.ceil(count / PAGE_SIZE);

  return {
    users: rows.map(u => ({
      userId:        u.user_id,
      userName:      u.user_name,
      userEmail:     u.user_email,
      userMobile:    u.user_mobile,
      userAvatar:    u.user_avatar,
      languageEnum:  u.preferred_language,
      userGenderId:  GenderEnum.indexOf(u.user_gender_id),
      locationId:    u.location_id,
      locationName:  u.location_name,
      isParticipant: !!u.is_participant,
      createdOn:     u.created_on,
    })),
    totalElements:   count,
    totalPages,
    currentPage:     pageIndex,
    pageSize:        PAGE_SIZE,
    hasNextPage:     pageIndex < totalPages - 1,
    hasPreviousPage: pageIndex > 0,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Issue #1269 — User Metrics
// Mirrors: UserServiceImpl.getUserMetrics() / UserAccountDetailsDTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieve account metrics for the authenticated user.
 *
 * Java contract (UserController.getUserMetrics → UserServiceImpl.getUserMetrics):
 *   - User identity derived from JWT token (NOT a path param).
 *   - Returns UserAccountDetailsDTO — user profile + aggregated activity counts.
 *   - 404 if userId not found in user_master.
 *
 * Database tables used:
 *   - user_master              (profile)
 *   - user_tag_map             (tag count)
 *   - user_trigger_map         (trigger count)
 *   - user_community_map       (community count)
 *   - user_story_interaction   (stories read — mark_as_read = 1)
 *   - user_story_map           (saved/bookmarked stories)
 *   - user_reaction_map        (story reactions)
 *   - user_submission          (user submissions)
 *
 * @param {number} userId - Derived from req.decodedToken.user_id
 * @returns {Object} UserAccountDetailsDTO-equivalent object
 */
const getUserMetrics = async (userId) => {
  // ── 1. Verify user exists ──────────────────────────────────────────────────
  const user = await model.user_master.findByPk(userId, { raw: true });
  if (!user) {
    const err = new Error(`User not found with id: ${userId}`);
    err.status = 404;
    throw err;
  }

  // ── 2. Fetch tags, triggers, communities ───────────────────────────────────
  const [tags, triggers, communities] = await Promise.all([
    model.user_tag_map.findAll({
      where: { user_id: userId },
      attributes: ['tag_id', 'tag_name'],
      raw: true,
    }),
    model.user_trigger_map.findAll({
      where: { user_id: userId },
      attributes: ['trigger_id', 'trigger_name'],
      raw: true,
    }),
    model.user_community_map.findAll({
      where: { user_id: userId },
      attributes: ['community_id'],
      raw: true,
    }),
  ]);

  // ── 3. Aggregate activity counts ───────────────────────────────────────────
  const [
    storiesReadCount,
    bookmarksCount,
    reactionsCount,
    submissionsCount,
  ] = await Promise.all([
    // Stories the user has marked as read (user_story_interaction.mark_as_read = 1)
    model.user_story_interaction.count({
      where: { user_id: userId, mark_as_read: 1 },
    }),
    // Stories the user has saved/bookmarked (user_story_map)
    model.user_story_map.count({
      where: { user_id: userId },
    }),
    // Reactions the user has given (user_reaction_map)
    model.user_reaction_map.count({
      where: { user_id: userId },
    }),
    // Submissions by the user (user_submission)
    model.user_submission.count({
      where: { user_id: userId },
    }),
  ]);

  // ── 4. Build UserAccountDetailsDTO ────────────────────────────────────────
  return {
    // User profile
    userId:       user.user_id,
    userName:     user.user_name,
    userEmail:    user.user_email,
    userMobile:   user.user_mobile,
    userAge:      user.user_age,
    userGenderId: GenderEnum.indexOf(user.user_gender_id),
    languageEnum: user.preferred_language,
    locationId:   user.location_id,
    locationName: user.location_name,
    userAvatar:   user.user_avatar,
    isEmailLogin: !!user.is_email_login,
    isParticipant: !!user.is_participant,
    createdOn:    user.created_on,
    updatedOn:    user.updated_on,

    // User preferences
    userTag:       tags.map(t => ({ tagId: t.tag_id, tagName: t.tag_name })),
    triggers:      triggers.map(t => ({ triggerId: t.trigger_id, triggerName: t.trigger_name })),
    userCommunity: communities.map(c => ({ communityId: c.community_id })),

    // Activity metrics
    metrics: {
      storiesRead:      storiesReadCount,
      bookmarksCount:   bookmarksCount,
      reactionsCount:   reactionsCount,
      submissionsCount: submissionsCount,
      tagsCount:        tags.length,
      triggersCount:    triggers.length,
      communitiesCount: communities.length,
    },
  };
};

module.exports = { saveUser, generateUserToken, checkExistingUser, updateUser, getUser, deleteUser, updateLanguage, readStory, addStoryBookmark ,getUserList, deleteStoryBookmark, addUserSubmission, getUserSubmission, getUserSubmissions, deleteUserSubmission, getUserSearch, getUserMetrics };