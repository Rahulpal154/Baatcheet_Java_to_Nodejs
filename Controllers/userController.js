'use strict';

const { matchedData } = require('express-validator');
const { handleValidationErrors } = require('../utils/helper');
const { saveUser, checkExistingUser, updateUser, getUser, deleteUser } = require('../services/userService');

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

module.exports = { registerUser, loginUser, updateUserById, getUserById, deleteUserById };
