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

module.exports = { saveUser, generateUserToken };
