// src/modules/auth/auth.service.js
/**
 * Authentication Service
 * Business logic for user authentication
 * Uses admin approval workflow (no email verification)
 */

const jwt = require('jsonwebtoken');
const { query, getClient } = require('../../config/database');
const authConfig = require('../../config/auth');
const { hashPassword, verifyPassword } = require('./password.service');
const logger = require('../../utils/logger');
const sessionsRepository = require('../sessions/sessions.repository');
const devicesRepository = require('../devices/devices.repository');

/**
 * Generate JWT access token
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
const generateAccessToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    facilityId: user.facility_id
  };
  
  return jwt.sign(payload, authConfig.jwt.secret, {
    expiresIn: authConfig.jwt.expiresIn,
    algorithm: authConfig.jwt.algorithm,
    issuer: authConfig.jwt.issuer,
    audience: authConfig.jwt.audience
  });
};

/**
 * Generate JWT refresh token
 * @param {Object} user - User object
 * @returns {string} Refresh token
 */
const generateRefreshToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email
  };
  
  return jwt.sign(payload, authConfig.refresh.secret, {
    expiresIn: authConfig.refresh.expiresIn
  });
};

/**
 * Calculate token expiration date
 * @returns {Date} Expiration date
 */
const getTokenExpirationDate = () => {
  // Parse expiresIn from authConfig (e.g., '7d', '24h', '1d')
  const expiresIn = authConfig.jwt.expiresIn || '7d';
  const match = expiresIn.match(/^(\d+)([dhms])$/);
  
  if (!match) {
    // Default to 7 days if parsing fails
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  let ms = 0;
  switch (unit) {
  case 'd':
    ms = value * 24 * 60 * 60 * 1000;
    break;
  case 'h':
    ms = value * 60 * 60 * 1000;
    break;
  case 'm':
    ms = value * 60 * 1000;
    break;
  case 's':
    ms = value * 1000;
    break;
  }
  
  return new Date(Date.now() + ms);
};

/**
 * Register a new user (admin only)
 * @param {Object} userData - User registration data
 * @param {Object} adminUser - Admin user creating the account
 * @returns {Promise<Object>} Created user and token
 */
const register = async (userData, adminUser) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Check if email already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [userData.email]
    );
    
    if (existingUser.rows.length > 0) {
      throw new Error('Email already registered');
    }
    
    // Check if phone already exists (if provided)
    if (userData.phone) {
      const existingPhone = await client.query(
        'SELECT id FROM users WHERE phone = $1',
        [userData.phone]
      );
      
      if (existingPhone.rows.length > 0) {
        throw new Error('Phone number already registered');
      }
    }
    
    // Validate facility exists if provided
    if (userData.facility_id) {
      const facility = await client.query(
        'SELECT id FROM facilities WHERE id = $1 AND is_active = TRUE',
        [userData.facility_id]
      );
      
      if (facility.rows.length === 0) {
        throw new Error('Invalid or inactive facility');
      }
    }
    
    // Validate supervisor exists if provided
    if (userData.supervisor_id) {
      const supervisor = await client.query(
        'SELECT id, role FROM users WHERE id = $1 AND is_active = TRUE',
        [userData.supervisor_id]
      );
      
      if (supervisor.rows.length === 0) {
        throw new Error('Invalid or inactive supervisor');
      }
    }
    
    // Hash password
    const passwordHash = await hashPassword(userData.password);
    
    // Insert user (admin-created users are automatically verified and active)
    const result = await client.query(
      `INSERT INTO users (
        email, phone, password_hash, first_name, last_name, role, 
        facility_id, supervisor_id, is_active, email_verified, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, email, phone, first_name, last_name, role, facility_id, supervisor_id, created_at`,
      [
        userData.email,
        userData.phone || null,
        passwordHash,
        userData.first_name,
        userData.last_name,
        userData.role,
        userData.facility_id || null,
        userData.supervisor_id || null,
        true, // is_active = TRUE (admin created)
        true, // email_verified = TRUE (admin created)
        JSON.stringify({ created_by: adminUser.id })
      ]
    );
    
    const newUser = result.rows[0];
    
    // Log activity
    await client.query(
      `INSERT INTO activities (user_id, action, entity_type, entity_id, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        adminUser.id,
        'create',
        'user',
        newUser.id,
        `User ${newUser.email} registered by admin`,
        JSON.stringify({ role: newUser.role, created_by: adminUser.email })
      ]
    );
    
    await client.query('COMMIT');
    
    logger.info('User registered successfully', {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      createdBy: adminUser.id
    });
    
    return {
      user: newUser,
      token: generateAccessToken(newUser),
      refreshToken: generateRefreshToken(newUser)
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('User registration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Login user
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {string} ipAddress - Request IP address
 * @param {string} userAgent - Request user agent
 * @param {string} deviceFingerprint - Optional device fingerprint for session tracking
 * @returns {Promise<Object>} User and token
 */
const login = async (email, password, ipAddress, userAgent, deviceFingerprint = null) => {
  try {
    // Fetch user with full details
    const result = await query(
      `SELECT 
        u.id, 
        u.email, 
        u.phone,
        u.password_hash,
        u.first_name, 
        u.last_name, 
        u.role, 
        u.facility_id,
        u.supervisor_id,
        u.is_active,
        u.email_verified,
        f.name as facility_name,
        f.code as facility_code,
        c.name as council_name,
        c.id as council_id,
        r.name as region_name,
        r.id as region_id
      FROM users u
      LEFT JOIN facilities f ON u.facility_id = f.id
      LEFT JOIN councils c ON f.council_id = c.id
      LEFT JOIN regions r ON c.region_id = r.id
      WHERE u.email = $1`,
      [email]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }
    
    const user = result.rows[0];
    
    // Check if user is active (admin approval flow)
    if (!user.is_active) {
      throw new Error('Account pending approval. Please contact administrator.');
    }
    
    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    
    if (!isPasswordValid) {
      // Log failed login attempt
      await query(
        `INSERT INTO activities (user_id, action, entity_type, entity_id, description, ip_address, user_agent, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          user.id,
          'login_failed',
          'auth',
          user.id,
          'Failed login attempt',
          ipAddress,
          userAgent,
          JSON.stringify({ reason: 'invalid_password' })
        ]
      );
      
      throw new Error('Invalid credentials');
    }
    
    // Generate tokens
    const token = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Invalidate all previous sessions for this user (enforce single session)
    await sessionsRepository.invalidateUserSessions(user.id, 'new_login');
    
    // Create new session
    await sessionsRepository.createSession({
      user_id: user.id,
      token,
      device_fingerprint: deviceFingerprint,
      ip_address: ipAddress,
      user_agent: userAgent,
      expires_at: getTokenExpirationDate()
    });
    
    // Register device if fingerprint provided
    if (deviceFingerprint) {
      await devicesRepository.registerDevice({
        user_id: user.id,
        device_fingerprint: deviceFingerprint,
        device_id: null,
        browser: extractBrowser(userAgent),
        platform: extractPlatform(userAgent)
      });
    }
    
    // Update last login time
    await query(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );
    
    // Log successful login
    await query(
      `INSERT INTO activities (user_id, action, entity_type, entity_id, description, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        user.id,
        'login',
        'auth',
        user.id,
        'Successful login',
        ipAddress,
        userAgent
      ]
    );
    
    // Remove password hash from response
    delete user.password_hash;
    
    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      role: user.role
    });
    
    return {
      user,
      token,
      refreshToken
    };
  } catch (error) {
    logger.error('Login failed:', error);
    throw error;
  }
};

/**
 * Extract browser name from user agent
 * @param {string} userAgent - User agent string
 * @returns {string|null} Browser name
 */
const extractBrowser = (userAgent) => {
  if (!userAgent) return null;
  
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  if (userAgent.includes('Opera')) return 'Opera';
  
  return 'Other';
};

/**
 * Extract platform from user agent
 * @param {string} userAgent - User agent string
 * @returns {string|null} Platform name
 */
const extractPlatform = (userAgent) => {
  if (!userAgent) return null;
  
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac')) return 'MacOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  
  return 'Other';
};

/**
 * Refresh access token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} New access token
 */
const refresh = async (refreshToken) => {
  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, authConfig.refresh.secret);
    
    // Fetch user
    const result = await query(
      `SELECT id, email, role, facility_id, is_active 
       FROM users 
       WHERE id = $1`,
      [decoded.userId]
    );
    
    if (result.rows.length === 0 || !result.rows[0].is_active) {
      throw new Error('Invalid refresh token');
    }
    
    const user = result.rows[0];
    
    logger.info('Token refreshed', { userId: user.id });
    
    return {
      token: generateAccessToken(user),
      refreshToken: generateRefreshToken(user)
    };
  } catch (error) {
    logger.error('Token refresh failed:', error);
    throw new Error('Invalid refresh token');
  }
};

/**
 * Self-registration (signup) for new users
 * Creates user with is_active = false (pending admin approval)
 * @param {Object} userData - User registration data
 * @param {string} ipAddress - Request IP address
 * @param {string} userAgent - Request user agent
 * @returns {Promise<Object>} Created user (without tokens, account pending approval)
 */
const signup = async (userData, ipAddress, userAgent) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Check if email already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [userData.email]
    );
    
    if (existingUser.rows.length > 0) {
      // Use generic message to prevent email enumeration
      throw new Error('Registration failed. Please check your information and try again.');
    }
    
    // Check if phone already exists
    const existingPhone = await client.query(
      'SELECT id FROM users WHERE phone = $1',
      [userData.phone]
    );
    
    if (existingPhone.rows.length > 0) {
      // Use generic message to prevent phone enumeration
      throw new Error('Registration failed. Please check your information and try again.');
    }
    
    // Validate facility exists if provided
    if (userData.facility_id) {
      const facility = await client.query(
        'SELECT id FROM facilities WHERE id = $1 AND is_active = TRUE',
        [userData.facility_id]
      );
      
      if (facility.rows.length === 0) {
        throw new Error('Invalid or inactive facility');
      }
    }
    
    // Hash password
    const passwordHash = await hashPassword(userData.password);
    
    // Insert user with is_active = FALSE (pending admin approval)
    const result = await client.query(
      `INSERT INTO users (
        email, phone, password_hash, first_name, last_name, role, 
        facility_id, is_active, email_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, email, phone, first_name, last_name, role, facility_id, is_active, created_at`,
      [
        userData.email,
        userData.phone,
        passwordHash,
        userData.first_name,
        userData.last_name,
        userData.role,
        userData.facility_id || null,
        false, // is_active = FALSE until admin approves
        true   // email_verified = TRUE (no email verification needed)
      ]
    );
    
    const newUser = result.rows[0];
    
    // Log signup activity
    await client.query(
      `INSERT INTO activities (user_id, action, entity_type, entity_id, description, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        newUser.id,
        'signup',
        'user',
        newUser.id,
        `User ${newUser.email} signed up (pending admin approval)`,
        ipAddress,
        userAgent,
        JSON.stringify({ role: newUser.role })
      ]
    );
    
    await client.query('COMMIT');
    
    logger.info('User signed up successfully (pending approval)', {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role
    });
    
    return {
      user: newUser,
      message: 'Registration successful! Please wait for admin approval.'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('User signup failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  register,
  login,
  refresh,
  signup,
  generateAccessToken,
  generateRefreshToken
};
