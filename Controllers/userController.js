'use strict';

const { matchedData } = require('express-validator');
const { handleValidationErrors } = require('../utils/helper');
const { saveUser, checkExistingUser } = require('../services/userService');

// ─────────────────────────────────────────────────────────────────────────────
// Cookie constants — mirrors Java CookieManager
// ─────────────────────────────────────────────────────────────────────────────
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 1 week (same as Java COOKIE_MAX_AGE)
const COOKIE_OPTS = {
  httpOnly: true,
  path: '/',
  maxAge: COOKIE_MAX_AGE_MS,
  sameSite: 'Lax',
};

/**
 * Helper — set all user cookies after successful login.
 * Mirrors Java: CookieManager.setUserTypeCookie / setLoginTimestampCookie /
 *               setJwtCookie / setAvatarFilePathCookie
 */
const setUserCookies = (res, jwtToken, avatarPath) => {
  res.cookie('user_type', 'USER', COOKIE_OPTS);
  res.cookie('login_timestamp', String(Date.now()), COOKIE_OPTS);
  res.cookie('jwt_token', jwtToken, COOKIE_OPTS);
  if (avatarPath) {
    res.cookie('avatar_file_path', avatarPath, COOKIE_OPTS);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /users/register  (Issue #1258)
// Mirrors: UserController.createUser() → UserServiceImpl.saveUser()
// ─────────────────────────────────────────────────────────────────────────────
const registerUser = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const data = matchedData(req, { includeOptionals: true });

    const userData = {
      userName:      data.userName,
      userAge:       data.userAge,
      userMobile:    data.userMobile || null,
      userGenderId:  data.userGenderId,
      languageEnum:  data.languageEnum !== undefined ? data.languageEnum : 0,
      locationId:    data.locationId,
      locationName:  data.locationName,
      userEmail:     data.userEmail,
      userAvatar:    data.userAvatar || null,
      triggers:      data.triggers || [],
      userTag:       data.userTag || [],
      userCommunity: data.userCommunity || [],
      isEmailLogin:  data.isEmailLogin !== undefined ? data.isEmailLogin : true,
    };

    const result = await saveUser(userData);
    return res.status(201).json(result);

  } catch (err) {
    console.error('[registerUser]', err.message);
    if (err.status === 409) return res.status(409).json({ message: err.message });
    if (err.status === 404) return res.status(404).json({ message: err.message });
    if (err.status === 400) return res.status(400).json({ message: err.message });
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /users/login  (Issue #1257)
// Mirrors: UserController.checkExistingUser() → UserServiceImpl.checkExistingUser()
// ─────────────────────────────────────────────────────────────────────────────
const loginUser = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const data = matchedData(req, { includeOptionals: true });

    // Java accepts either userEmail OR userMobile (not both required)
    const { userEmail, userMobile } = data;

    const result = await checkExistingUser(
      userEmail  || null,
      userMobile || null
    );

    // If user found → set cookies (mirrors Java CookieManager in checkExistingUser)
    if (result.userExists === 'TRUE') {
      // Remove old cookies first (mirrors cookieManager.removeUserCookies)
      res.clearCookie('user_type',         { path: '/' });
      res.clearCookie('login_timestamp',   { path: '/' });
      res.clearCookie('jwt_token',         { path: '/' });
      res.clearCookie('avatar_file_path',  { path: '/' });

      setUserCookies(res, result.jwtToken, null /* avatar fetched if needed */);
    }

    // Java always returns 200 whether user exists or not
    return res.status(200).json(result);

  } catch (err) {
    console.error('[loginUser]', err.message);
    return res.status(500).json({ ERROR: 'Internal server Error', DETAILS: err.message });
  }
};

module.exports = { registerUser, loginUser };
