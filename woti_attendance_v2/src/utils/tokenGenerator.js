// src/utils/tokenGenerator.js
/**
 * Token Generation Utilities
 * Generate verification tokens and codes
 */

const crypto = require('crypto');

/**
 * Generate a 6-digit verification code
 * @returns {string} 6-digit code
 */
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generate a UUID verification token
 * @returns {string} UUID token
 */
const generateVerificationToken = () => {
  return crypto.randomUUID();
};

/**
 * Generate a random token using crypto
 * @param {number} length - Length of token (default: 32)
 * @returns {string} Random token
 */
const generateRandomToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Get token expiration date (24 hours from now)
 * @returns {Date} Expiration date
 */
const getTokenExpiration = () => {
  const expirationDate = new Date();
  expirationDate.setHours(expirationDate.getHours() + 24);
  return expirationDate;
};

module.exports = {
  generateVerificationCode,
  generateVerificationToken,
  generateRandomToken,
  getTokenExpiration
};
