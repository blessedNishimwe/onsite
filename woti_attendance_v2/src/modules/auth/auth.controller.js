// src/modules/auth/auth.controller.js
/**
 * Authentication Controller
 * Handles HTTP requests for authentication endpoints
 */

const authService = require('./auth.service');
const { asyncHandler } = require('../../middleware/errorHandler.middleware');
const logger = require('../../utils/logger');

/**
 * Register new user (admin only)
 * POST /api/auth/register
 */
const register = asyncHandler(async (req, res) => {
  const userData = req.body;
  const adminUser = req.user;
  
  const result = await authService.register(userData, adminUser);
  
  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: result.user,
      token: result.token,
      refreshToken: result.refreshToken
    }
  });
});

/**
 * Login user
 * POST /api/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];
  
  const result = await authService.login(email, password, ipAddress, userAgent);
  
  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: result.user,
      token: result.token,
      refreshToken: result.refreshToken
    }
  });
});

/**
 * Refresh access token
 * POST /api/auth/refresh
 */
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Refresh token is required'
    });
  }
  
  const result = await authService.refresh(refreshToken);
  
  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      token: result.token,
      refreshToken: result.refreshToken
    }
  });
});

/**
 * Logout user (client-side token removal)
 * POST /api/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  // Log logout activity
  const { query } = require('../../config/database');
  
  await query(
    `INSERT INTO activities (user_id, action, entity_type, entity_id, description, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      req.user.id,
      'logout',
      'auth',
      req.user.id,
      'User logged out',
      req.ip || req.connection.remoteAddress,
      req.headers['user-agent']
    ]
  );
  
  logger.info('User logged out', { userId: req.user.id });
  
  res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
});

/**
 * Get current user info
 * GET /api/auth/me
 */
const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user
    }
  });
});

/**
 * Self-registration (signup)
 * POST /api/auth/signup
 */
const signup = asyncHandler(async (req, res) => {
  const userData = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'];
  
  const result = await authService.signup(userData, ipAddress, userAgent);
  
  res.status(201).json({
    success: true,
    message: result.message,
    data: {
      user: result.user
    }
  });
});

/**
 * Verify email with token
 * POST /api/auth/verify-email
 */
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.body;
  
  const result = await authService.verifyEmail(token);
  
  res.status(200).json({
    success: true,
    message: 'Email verified successfully. You can now login.',
    data: {
      user: result.user,
      token: result.token,
      refreshToken: result.refreshToken
    }
  });
});

/**
 * Resend verification email
 * POST /api/auth/resend-verification
 */
const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  const result = await authService.resendVerification(email);
  
  res.status(200).json({
    success: true,
    message: result.message
  });
});

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  signup,
  verifyEmail,
  resendVerification
};
