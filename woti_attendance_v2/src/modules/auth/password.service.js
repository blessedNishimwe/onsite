// src/modules/auth/password.service.js
/**
 * Password Service
 * Handles password hashing and verification using bcrypt
 */

const bcrypt = require('bcrypt');
const authConfig = require('../../config/auth');
const logger = require('../../utils/logger');

/**
 * Hash password using bcrypt with 12 rounds
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(authConfig.bcrypt.rounds);
    const hash = await bcrypt.hash(password, salt);
    logger.debug('Password hashed successfully');
    return hash;
  } catch (error) {
    logger.error('Error hashing password:', error);
    throw new Error('Password hashing failed');
  }
};

/**
 * Verify password against hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} Whether password matches
 */
const verifyPassword = async (password, hash) => {
  try {
    const isMatch = await bcrypt.compare(password, hash);
    logger.debug('Password verification completed', { isMatch });
    return isMatch;
  } catch (error) {
    logger.error('Error verifying password:', error);
    throw new Error('Password verification failed');
  }
};

module.exports = {
  hashPassword,
  verifyPassword
};
