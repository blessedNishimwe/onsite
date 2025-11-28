// src/modules/sessions/sessions.repository.js
/**
 * Sessions Repository
 * Database operations for user session management
 */

const crypto = require('crypto');
const { query } = require('../../config/database');
const logger = require('../../utils/logger');

/**
 * Hash a token for storage
 * @param {string} token - JWT token to hash
 * @returns {string} SHA-256 hash of the token
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Create a new session
 * @param {Object} sessionData - Session data
 * @returns {Promise<Object>} Created session
 */
const createSession = async (sessionData) => {
  const tokenHash = hashToken(sessionData.token);
  
  const result = await query(
    `INSERT INTO user_sessions (
      user_id, device_fingerprint, token_hash, ip_address, 
      user_agent, is_active, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, user_id, device_fingerprint, is_active, expires_at, created_at`,
    [
      sessionData.user_id,
      sessionData.device_fingerprint || null,
      tokenHash,
      sessionData.ip_address || null,
      sessionData.user_agent || null,
      true,
      sessionData.expires_at
    ]
  );
  
  logger.info('Session created', {
    userId: sessionData.user_id,
    sessionId: result.rows[0].id
  });
  
  return result.rows[0];
};

/**
 * Invalidate all active sessions for a user
 * @param {string} userId - User ID
 * @param {string} reason - Reason for invalidation
 * @param {string} exceptSessionId - Optional session ID to exclude from invalidation
 * @returns {Promise<number>} Number of sessions invalidated
 */
const invalidateUserSessions = async (userId, reason = 'new_login', exceptSessionId = null) => {
  let queryText = `
    UPDATE user_sessions 
    SET is_active = FALSE,
        invalidated_at = NOW(),
        invalidation_reason = $2
    WHERE user_id = $1 AND is_active = TRUE
  `;
  const params = [userId, reason];
  
  if (exceptSessionId) {
    queryText += ' AND id != $3';
    params.push(exceptSessionId);
  }
  
  queryText += ' RETURNING id';
  
  const result = await query(queryText, params);
  
  if (result.rows.length > 0) {
    logger.info('Sessions invalidated', {
      userId,
      reason,
      count: result.rows.length
    });
  }
  
  return result.rows.length;
};

/**
 * Find active session by token hash
 * @param {string} token - JWT token
 * @returns {Promise<Object|null>} Session or null
 */
const findActiveSessionByToken = async (token) => {
  const tokenHash = hashToken(token);
  
  const result = await query(
    `SELECT s.*, u.is_active as user_is_active
     FROM user_sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.token_hash = $1 
       AND s.is_active = TRUE 
       AND s.expires_at > NOW()`,
    [tokenHash]
  );
  
  return result.rows[0] || null;
};

/**
 * Find all active sessions for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Active sessions
 */
const findActiveSessionsByUserId = async (userId) => {
  const result = await query(
    `SELECT id, device_fingerprint, ip_address, user_agent, 
            expires_at, created_at
     FROM user_sessions
     WHERE user_id = $1 AND is_active = TRUE AND expires_at > NOW()
     ORDER BY created_at DESC`,
    [userId]
  );
  
  return result.rows;
};

/**
 * Invalidate a specific session
 * @param {string} sessionId - Session ID
 * @param {string} reason - Reason for invalidation
 * @returns {Promise<boolean>} Whether session was invalidated
 */
const invalidateSession = async (sessionId, reason = 'logout') => {
  const result = await query(
    `UPDATE user_sessions 
     SET is_active = FALSE,
         invalidated_at = NOW(),
         invalidation_reason = $2
     WHERE id = $1 AND is_active = TRUE
     RETURNING id`,
    [sessionId, reason]
  );
  
  return result.rows.length > 0;
};

/**
 * Count active sessions for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of active sessions
 */
const countActiveSessions = async (userId) => {
  const result = await query(
    `SELECT COUNT(*) as count
     FROM user_sessions
     WHERE user_id = $1 AND is_active = TRUE AND expires_at > NOW()`,
    [userId]
  );
  
  return parseInt(result.rows[0].count);
};

/**
 * Clean up expired sessions (for scheduled job)
 * @returns {Promise<number>} Number of sessions cleaned
 */
const cleanupExpiredSessions = async () => {
  const result = await query(
    `UPDATE user_sessions 
     SET is_active = FALSE,
         invalidated_at = NOW(),
         invalidation_reason = 'expired'
     WHERE is_active = TRUE AND expires_at < NOW()
     RETURNING id`
  );
  
  if (result.rows.length > 0) {
    logger.info('Expired sessions cleaned up', { count: result.rows.length });
  }
  
  return result.rows.length;
};

module.exports = {
  hashToken,
  createSession,
  invalidateUserSessions,
  findActiveSessionByToken,
  findActiveSessionsByUserId,
  invalidateSession,
  countActiveSessions,
  cleanupExpiredSessions
};
