// src/modules/auth/auth.routes.js
/**
 * Authentication Routes
 * Defines routes for authentication endpoints
 * Uses admin approval workflow (no email verification)
 */

const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { requireAdmin } = require('../../middleware/roleAuth.middleware');
const { 
  validateRegistration, 
  validateLogin,
  validateSignup
} = require('../../middleware/validation.middleware');
const { authRateLimiter } = require('../../middleware/rateLimiter.middleware');

/**
 * @route   POST /api/auth/register
 * @desc    Register new user (admin only)
 * @access  Private/Admin
 */
router.post(
  '/register',
  authRateLimiter,
  authenticate,
  requireAdmin,
  validateRegistration,
  authController.register
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  authRateLimiter,
  validateLogin,
  authController.login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh',
  authController.refreshToken
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  '/logout',
  authenticate,
  authController.logout
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  authController.getMe
);

/**
 * @route   POST /api/auth/signup
 * @desc    Self-registration for new users (pending admin approval)
 * @access  Public
 */
router.post(
  '/signup',
  authRateLimiter,
  validateSignup,
  authController.signup
);

module.exports = router;
