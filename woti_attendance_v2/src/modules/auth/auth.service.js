// src/modules/auth/auth.service.js
/**
 * Authentication Service
 * Business logic for user authentication
 */

const jwt = require('jsonwebtoken');
const { query, getClient } = require('../../config/database');
const authConfig = require('../../config/auth');
const { hashPassword, verifyPassword } = require('./password.service');
const logger = require('../../utils/logger');

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
 * @returns {Promise<Object>} User and token
 */
const login = async (email, password, ipAddress, userAgent) => {
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
    
    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is inactive. Please verify your email or contact support.');
    }
    
    // Check if email is verified (only for non-admin created users)
    if (!user.email_verified) {
      throw new Error('Email not verified. Please check your email for verification code.');
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
      token: generateAccessToken(user),
      refreshToken: generateRefreshToken(user)
    };
  } catch (error) {
    logger.error('Login failed:', error);
    throw error;
  }
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
 * @param {Object} userData - User registration data
 * @param {string} ipAddress - Request IP address
 * @param {string} userAgent - Request user agent
 * @returns {Promise<Object>} Created user (without tokens, account not active yet)
 */
const signup = async (userData, ipAddress, userAgent) => {
  const client = await getClient();
  const { generateVerificationCode, getTokenExpiration } = require('../../utils/tokenGenerator');
  const { sendVerificationEmail } = require('../email/email.service');
  
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
    
    // Check if phone already exists
    const existingPhone = await client.query(
      'SELECT id FROM users WHERE phone = $1',
      [userData.phone]
    );
    
    if (existingPhone.rows.length > 0) {
      throw new Error('Phone number already registered');
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
    
    // Generate verification token (6-digit code)
    const verificationToken = generateVerificationCode();
    const verificationTokenExpires = getTokenExpiration();
    
    // Insert user with is_active = FALSE and email_verified = FALSE
    const result = await client.query(
      `INSERT INTO users (
        email, phone, password_hash, first_name, last_name, role, 
        facility_id, is_active, email_verified, verification_token, verification_token_expires
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, email, phone, first_name, last_name, role, facility_id, is_active, email_verified, created_at`,
      [
        userData.email,
        userData.phone,
        passwordHash,
        userData.first_name,
        userData.last_name,
        userData.role,
        userData.facility_id || null,
        false, // is_active = FALSE until email verified
        false, // email_verified = FALSE
        verificationToken,
        verificationTokenExpires
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
        `User ${newUser.email} signed up (email verification pending)`,
        ipAddress,
        userAgent,
        JSON.stringify({ role: newUser.role })
      ]
    );
    
    await client.query('COMMIT');
    
    // Send verification email (don't fail signup if email fails)
    try {
      await sendVerificationEmail(
        newUser.email,
        newUser.first_name,
        verificationToken
      );
    } catch (emailError) {
      logger.error('Failed to send verification email during signup', {
        userId: newUser.id,
        email: newUser.email,
        error: emailError.message
      });
      // Continue - user can request resend later
    }
    
    logger.info('User signed up successfully', {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role
    });
    
    return {
      user: newUser,
      message: 'Registration successful. Please check your email for verification code.'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('User signup failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Verify user email with token
 * @param {string} token - Verification token
 * @returns {Promise<Object>} Verification result with tokens
 */
const verifyEmail = async (token) => {
  const client = await getClient();
  const { sendVerificationSuccessEmail } = require('../email/email.service');
  
  try {
    await client.query('BEGIN');
    
    // Find user with matching token
    const result = await client.query(
      `SELECT id, email, first_name, last_name, role, facility_id, verification_token_expires
       FROM users 
       WHERE verification_token = $1 AND email_verified = FALSE`,
      [token]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Invalid or expired verification token');
    }
    
    const user = result.rows[0];
    
    // Check if token is expired
    const now = new Date();
    if (now > new Date(user.verification_token_expires)) {
      throw new Error('Verification token has expired. Please request a new one.');
    }
    
    // Update user: set email_verified = TRUE, is_active = TRUE, clear token
    await client.query(
      `UPDATE users 
       SET email_verified = TRUE, 
           is_active = TRUE, 
           verification_token = NULL, 
           verification_token_expires = NULL
       WHERE id = $1`,
      [user.id]
    );
    
    // Log verification success
    await client.query(
      `INSERT INTO activities (user_id, action, entity_type, entity_id, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        user.id,
        'email_verified',
        'user',
        user.id,
        `User ${user.email} verified email successfully`,
        JSON.stringify({ verification_method: 'email_token' })
      ]
    );
    
    await client.query('COMMIT');
    
    // Send success confirmation email (don't fail if this fails)
    try {
      await sendVerificationSuccessEmail(user.email, user.first_name);
    } catch (emailError) {
      logger.error('Failed to send verification success email', {
        userId: user.id,
        error: emailError.message
      });
    }
    
    logger.info('Email verified successfully', {
      userId: user.id,
      email: user.email
    });
    
    // Generate tokens for immediate login
    const userForToken = {
      id: user.id,
      email: user.email,
      role: user.role,
      facility_id: user.facility_id
    };
    
    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        facility_id: user.facility_id
      },
      token: generateAccessToken(userForToken),
      refreshToken: generateRefreshToken(userForToken)
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Email verification failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Resend verification email
 * @param {string} email - User email
 * @returns {Promise<Object>} Resend result
 */
const resendVerification = async (email) => {
  const client = await getClient();
  const { generateVerificationCode, getTokenExpiration } = require('../../utils/tokenGenerator');
  const { sendVerificationEmail } = require('../email/email.service');
  
  try {
    await client.query('BEGIN');
    
    // Find user by email
    const result = await client.query(
      `SELECT id, email, first_name, email_verified, is_active 
       FROM users 
       WHERE email = $1`,
      [email]
    );
    
    if (result.rows.length === 0) {
      throw new Error('User not found');
    }
    
    const user = result.rows[0];
    
    // Check if already verified
    if (user.email_verified) {
      throw new Error('Email already verified');
    }
    
    // Generate new verification token
    const verificationToken = generateVerificationCode();
    const verificationTokenExpires = getTokenExpiration();
    
    // Update user with new token
    await client.query(
      `UPDATE users 
       SET verification_token = $1, verification_token_expires = $2
       WHERE id = $3`,
      [verificationToken, verificationTokenExpires, user.id]
    );
    
    // Log resend activity
    await client.query(
      `INSERT INTO activities (user_id, action, entity_type, entity_id, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.id,
        'resend_verification',
        'user',
        user.id,
        `Verification email resent to ${user.email}`
      ]
    );
    
    await client.query('COMMIT');
    
    // Send verification email
    await sendVerificationEmail(
      user.email,
      user.first_name,
      verificationToken
    );
    
    logger.info('Verification email resent', {
      userId: user.id,
      email: user.email
    });
    
    return {
      success: true,
      message: 'Verification email sent successfully'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to resend verification email:', error);
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
  verifyEmail,
  resendVerification,
  generateAccessToken,
  generateRefreshToken
};
