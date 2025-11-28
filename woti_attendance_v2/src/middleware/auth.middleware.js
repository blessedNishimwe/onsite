// src/middleware/auth.middleware.js
/**
 * JWT Authentication Middleware
 * Verifies JWT tokens and attaches user info to request
 */

const jwt = require('jsonwebtoken');
const authConfig = require('../config/auth');
const logger = require('../utils/logger');
const { query } = require('../config/database');
const sessionsRepository = require('../modules/sessions/sessions.repository');

/**
 * Verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'No token provided'
      });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, authConfig.jwt.secret, {
        algorithms: [authConfig.jwt.algorithm],
        issuer: authConfig.jwt.issuer,
        audience: authConfig.jwt.audience
      });
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }
      
      throw jwtError;
    }
    
    // Validate session is active (if session management is enabled)
    try {
      const session = await sessionsRepository.findActiveSessionByToken(token);
      
      if (!session) {
        // Session not found or invalidated - user logged in elsewhere
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Session expired. Please log in again.',
          code: 'SESSION_INVALIDATED'
        });
      }
      
      // Check if user is still active
      if (!session.user_is_active) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Account deactivated. Please contact administrator.',
          code: 'ACCOUNT_DEACTIVATED'
        });
      }
      
      // Attach session info to request
      req.sessionId = session.id;
    } catch (sessionError) {
      // If session table doesn't exist yet (migration not run), continue without session validation
      if (sessionError.code !== '42P01') { // 42P01 = undefined_table
        logger.warn('Session validation error:', sessionError.message);
      }
    }
    
    // Fetch user from database
    const result = await query(
      `SELECT 
        u.id, 
        u.email, 
        u.phone,
        u.first_name, 
        u.last_name, 
        u.role, 
        u.facility_id,
        u.supervisor_id,
        u.is_active,
        f.name as facility_name,
        f.code as facility_code,
        c.name as council_name,
        r.name as region_name
      FROM users u
      LEFT JOIN facilities f ON u.facility_id = f.id
      LEFT JOIN councils c ON f.council_id = c.id
      LEFT JOIN regions r ON c.region_id = r.id
      WHERE u.id = $1 AND u.is_active = TRUE`,
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not found or inactive'
      });
    }
    
    // Attach user to request
    req.user = result.rows[0];
    req.token = decoded;
    
    logger.debug('User authenticated', {
      userId: req.user.id,
      role: req.user.role
    });
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuthenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }
  
  // If token exists, validate it
  return authenticate(req, res, next);
};

module.exports = {
  authenticate,
  optionalAuthenticate
};
