'use strict';

const { matchedData } = require('express-validator');
const { handleValidationErrors } = require('../utils/helper');
const { saveUser } = require('../services/userService');

/**
 * POST /users/register
 * Mirrors: UserController.createUser() → UserServiceImpl.saveUser()
 * Success: 201 UserResponseDto
 * Error:   409 duplicate, 404 not found, 422 validation
 */
const registerUser = async (req, res) => {
  try {
    if (handleValidationErrors(req, res)) return;

    const data = matchedData(req, { includeOptionals: true });

    const userData = {
      userName: data.userName,
      userAge: data.userAge,
      userMobile: data.userMobile || null,
      userGenderId: data.userGenderId,
      languageEnum: data.languageEnum !== undefined ? data.languageEnum : 0,
      locationId: data.locationId,
      locationName: data.locationName,
      userEmail: data.userEmail,
      userAvatar: data.userAvatar || null,
      triggers: data.triggers || [],
      userTag: data.userTag || [],
      userCommunity: data.userCommunity || [],
      isEmailLogin: data.isEmailLogin !== undefined ? data.isEmailLogin : true,
    };

    const result = await saveUser(userData);
    return res.status(201).json(result);

  } catch (err) {
    console.error('[registerUser]', err.message);

    if (err.status === 409) {
      return res.status(409).json({ message: err.message });
    }
    if (err.status === 404) {
      return res.status(404).json({ message: err.message });
    }
    if (err.status === 400) {
      return res.status(400).json({ message: err.message });
    }

    return res.status(500).json({
      ERROR: 'Internal server Error',
      DETAILS: err.message,
    });
  }
};

module.exports = { registerUser };
